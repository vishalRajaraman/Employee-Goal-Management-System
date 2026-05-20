const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'goal_tracker.db');

class Database {
    constructor() {
        this.db = null;
        this.initPromise = this.initialize();
    }

    async initialize() {
        try {
            const SQL = await initSqlJs();
            
            // Load existing database or create new one
            let fileBuffer;
            if (fs.existsSync(DB_PATH)) {
                fileBuffer = fs.readFileSync(DB_PATH);
                this.db = new SQL.Database(fileBuffer);
            } else {
                this.db = new SQL.Database();
            }
            
            console.log('Connected to SQLite database');
            this.initializeTables();
            this.saveDatabase();
        } catch (err) {
            console.error('Error opening database:', err);
        }
    }

    saveDatabase() {
        if (this.db) {
            const data = this.db.export();
            const buffer = Buffer.from(data);
            fs.writeFileSync(DB_PATH, buffer);
        }
    }

    initializeTables() {
        // Users table
        this.db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                name TEXT NOT NULL,
                role TEXT NOT NULL CHECK(role IN ('employee', 'manager', 'admin')),
                manager_id TEXT,
                department TEXT,
                thrust_area TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Thrust Areas table
        this.db.run(`
            CREATE TABLE IF NOT EXISTS thrust_areas (
                id TEXT PRIMARY KEY,
                name TEXT UNIQUE NOT NULL,
                description TEXT,
                is_active INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Goal Cycles table
        this.db.run(`
            CREATE TABLE IF NOT EXISTS goal_cycles (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                year INTEGER NOT NULL,
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'active', 'closed')),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Goals table
        this.db.run(`
            CREATE TABLE IF NOT EXISTS goals (
                id TEXT PRIMARY KEY,
                employee_id TEXT NOT NULL,
                cycle_id TEXT NOT NULL,
                thrust_area_id TEXT,
                title TEXT NOT NULL,
                description TEXT,
                uom_type TEXT NOT NULL CHECK(uom_type IN ('numeric_min', 'numeric_max', 'percent_min', 'percent_max', 'timeline', 'zero')),
                target_value TEXT NOT NULL,
                weightage INTEGER NOT NULL CHECK(weightage >= 10 AND weightage <= 100),
                status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'submitted', 'approved', 'rejected', 'locked')),
                is_shared INTEGER DEFAULT 0,
                shared_by TEXT,
                is_readonly INTEGER DEFAULT 0,
                primary_owner_id TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Goal Achievements table (Quarterly Check-ins)
        this.db.run(`
            CREATE TABLE IF NOT EXISTS goal_achievements (
                id TEXT PRIMARY KEY,
                goal_id TEXT NOT NULL,
                quarter TEXT NOT NULL CHECK(quarter IN ('Q1', 'Q2', 'Q3', 'Q4')),
                planned_target TEXT NOT NULL,
                actual_achievement TEXT,
                status TEXT DEFAULT 'not_started' CHECK(status IN ('not_started', 'on_track', 'completed', 'delayed')),
                progress_score REAL,
                employee_comment TEXT,
                manager_comment TEXT,
                check_in_date DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Manager Check-ins table
        this.db.run(`
            CREATE TABLE IF NOT EXISTS manager_checkins (
                id TEXT PRIMARY KEY,
                employee_id TEXT NOT NULL,
                cycle_id TEXT NOT NULL,
                quarter TEXT NOT NULL,
                check_in_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                comments TEXT,
                manager_id TEXT NOT NULL,
                status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'completed'))
            )
        `);

        // Audit Logs table
        this.db.run(`
            CREATE TABLE IF NOT EXISTS audit_logs (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                action TEXT NOT NULL,
                entity_type TEXT NOT NULL,
                entity_id TEXT NOT NULL,
                old_values TEXT,
                new_values TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Escalations table
        this.db.run(`
            CREATE TABLE IF NOT EXISTS escalations (
                id TEXT PRIMARY KEY,
                rule_name TEXT NOT NULL,
                triggered_by TEXT NOT NULL,
                target_user_id TEXT NOT NULL,
                escalation_level INTEGER DEFAULT 1,
                status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'resolved', 'dismissed')),
                message TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                resolved_at DATETIME
            )
        `);

        // Email Notifications queue
        this.db.run(`
            CREATE TABLE IF NOT EXISTS email_notifications (
                id TEXT PRIMARY KEY,
                recipient_email TEXT NOT NULL,
                subject TEXT NOT NULL,
                body TEXT NOT NULL,
                status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'sent', 'failed')),
                sent_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Insert default admin user if not exists
        const adminExists = this.db.exec("SELECT id FROM users WHERE email = 'admin@atomquest.com'");
        if (adminExists.length === 0) {
            const adminId = uuidv4();
            const hashedPassword = bcrypt.hashSync('admin123', 10);
            this.db.run(`
                INSERT INTO users (id, email, password, name, role, department)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [adminId, 'admin@atomquest.com', hashedPassword, 'System Admin', 'admin', 'HR']);
        }

        // Insert default thrust areas
        const existingAreas = this.db.exec("SELECT id FROM thrust_areas");
        if (existingAreas.length === 0) {
            const defaultThrustAreas = [
                ['Customer Excellence', 'Focus on customer satisfaction and service quality'],
                ['Operational Efficiency', 'Improve processes and reduce waste'],
                ['Innovation & Growth', 'Drive new initiatives and business growth'],
                ['People & Culture', 'Build team capabilities and engagement'],
                ['Financial Performance', 'Achieve financial targets and cost optimization'],
                ['Digital Transformation', 'Leverage technology for business advantage'],
                ['Quality & Compliance', 'Ensure quality standards and regulatory compliance'],
                ['Sustainability', 'Environmental and social responsibility initiatives']
            ];

            defaultThrustAreas.forEach(([name, desc]) => {
                this.db.run(`
                    INSERT INTO thrust_areas (id, name, description)
                    VALUES (?, ?, ?)
                `, [uuidv4(), name, desc]);
            });
        }

        // Insert default goal cycle
        const currentYear = new Date().getFullYear();
        const existingCycle = this.db.exec(`SELECT id FROM goal_cycles WHERE year = ${currentYear}`);
        if (existingCycle.length === 0) {
            const cycleId = uuidv4();
            this.db.run(`
                INSERT INTO goal_cycles (id, name, year, start_date, end_date, status)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [cycleId, `FY ${currentYear} Goal Cycle`, currentYear, `${currentYear}-05-01`, `${currentYear + 1}-04-30`, 'active']);
        }

        console.log('Database tables initialized successfully');
    }

    // Generic query methods
    async run(sql, params = []) {
        await this.initPromise;
        this.db.run(sql, params);
        this.saveDatabase();
        return { lastID: null, changes: this.db.getRowsModified() };
    }

    async get(sql, params = []) {
        await this.initPromise;
        const stmt = this.db.prepare(sql);
        if (params.length > 0) {
            stmt.bind(params);
        }
        let result = null;
        if (stmt.step()) {
            result = stmt.getAsObject();
        }
        stmt.free();
        return result;
    }

    async all(sql, params = []) {
        await this.initPromise;
        const stmt = this.db.prepare(sql);
        if (params.length > 0) {
            stmt.bind(params);
        }
        const results = [];
        while (stmt.step()) {
            results.push(stmt.getAsObject());
        }
        stmt.free();
        return results;
    }

    close() {
        if (this.db) {
            this.saveDatabase();
            this.db.close();
            console.log('Database connection closed');
        }
    }
}

module.exports = new Database();
