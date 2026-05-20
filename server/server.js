const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'atomquest-hackathon-2024-secret-key';

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../public')));

// Auth middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

// Role-based authorization middleware
const authorizeRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
    };
};

// Audit logging helper
async function logAudit(userId, action, entityType, entityId, oldValues = null, newValues = null) {
    const auditId = uuidv4();
    await db.run(`
        INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, old_values, new_values)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [auditId, userId, action, entityType, entityId, 
        oldValues ? JSON.stringify(oldValues) : null, 
        newValues ? JSON.stringify(newValues) : null]);
}

// ==================== AUTH ROUTES ====================

// Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        
        const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
        
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const validPassword = await bcrypt.compare(password, user.password);
        
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role, name: user.name },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                manager_id: user.manager_id,
                department: user.department
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Register user (Admin only)
app.post('/api/users', authenticateToken, authorizeRole('admin', 'manager'), async (req, res) => {
    try {
        const { email, password, name, role, manager_id, department, thrust_area } = req.body;
        
        if (!email || !password || !name || !role) {
            return res.status(400).json({ error: 'Email, password, name, and role are required' });
        }
        
        const existingUser = await db.get('SELECT id FROM users WHERE email = ?', [email]);
        if (existingUser) {
            return res.status(400).json({ error: 'Email already exists' });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const userId = uuidv4();
        
        await db.run(`
            INSERT INTO users (id, email, password, name, role, manager_id, department, thrust_area)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [userId, email, hashedPassword, name, role, manager_id || null, department || null, thrust_area || null]);
        
        await logAudit(req.user.id, 'CREATE', 'user', userId, null, { email, name, role });
        
        res.status(201).json({ message: 'User created successfully', user_id: userId });
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get current user profile
app.get('/api/users/me', authenticateToken, async (req, res) => {
    try {
        const user = await db.get(`
            SELECT u.*, m.name as manager_name 
            FROM users u
            LEFT JOIN users m ON u.manager_id = m.id
            WHERE u.id = ?
        `, [req.user.id]);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        delete user.password;
        res.json({ user });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all users (Admin/Manager)
app.get('/api/users', authenticateToken, async (req, res) => {
    try {
        let sql = `SELECT id, email, name, role, manager_id, department, thrust_area, created_at FROM users`;
        let params = [];
        
        if (req.user.role === 'manager') {
            sql += ' WHERE manager_id = ? OR id = ?';
            params = [req.user.id, req.user.id];
        }
        
        const users = await db.all(sql, params);
        res.json({ users });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ==================== THRUST AREA ROUTES ====================

app.get('/api/thrust-areas', authenticateToken, async (req, res) => {
    try {
        const areas = await db.all('SELECT * FROM thrust_areas WHERE is_active = 1 ORDER BY name');
        res.json({ thrust_areas: areas });
    } catch (error) {
        console.error('Get thrust areas error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ==================== GOAL CYCLE ROUTES ====================

app.get('/api/cycles', authenticateToken, async (req, res) => {
    try {
        const cycles = await db.all('SELECT * FROM goal_cycles ORDER BY year DESC, start_date DESC');
        res.json({ cycles });
    } catch (error) {
        console.error('Get cycles error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/cycles/:id', authenticateToken, async (req, res) => {
    try {
        const cycle = await db.get('SELECT * FROM goal_cycles WHERE id = ?', [req.params.id]);
        if (!cycle) {
            return res.status(404).json({ error: 'Cycle not found' });
        }
        res.json({ cycle });
    } catch (error) {
        console.error('Get cycle error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin: Create cycle
app.post('/api/cycles', authenticateToken, authorizeRole('admin'), async (req, res) => {
    try {
        const { name, year, start_date, end_date } = req.body;
        
        if (!name || !year || !start_date || !end_date) {
            return res.status(400).json({ error: 'All fields are required' });
        }
        
        const cycleId = uuidv4();
        await db.run(`
            INSERT INTO goal_cycles (id, name, year, start_date, end_date, status)
            VALUES (?, ?, ?, ?, ?, 'draft')
        `, [cycleId, name, year, start_date, end_date]);
        
        await logAudit(req.user.id, 'CREATE', 'cycle', cycleId, null, req.body);
        
        res.status(201).json({ message: 'Cycle created successfully', cycle_id: cycleId });
    } catch (error) {
        console.error('Create cycle error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin: Update cycle status
app.patch('/api/cycles/:id/status', authenticateToken, authorizeRole('admin'), async (req, res) => {
    try {
        const { status } = req.body;
        if (!['draft', 'active', 'closed'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }
        
        const oldCycle = await db.get('SELECT * FROM goal_cycles WHERE id = ?', [req.params.id]);
        await db.run('UPDATE goal_cycles SET status = ? WHERE id = ?', [status, req.params.id]);
        
        await logAudit(req.user.id, 'UPDATE', 'cycle', req.params.id, 
            { status: oldCycle?.status }, { status });
        
        res.json({ message: 'Cycle status updated' });
    } catch (error) {
        console.error('Update cycle error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ==================== GOAL ROUTES ====================

// Get employee's goals
app.get('/api/goals/my-goals', authenticateToken, async (req, res) => {
    try {
        const { cycle_id } = req.query;
        
        let sql = `
            SELECT g.*, t.name as thrust_area_name, u.name as primary_owner_name
            FROM goals g
            LEFT JOIN thrust_areas t ON g.thrust_area_id = t.id
            LEFT JOIN users u ON g.primary_owner_id = u.id
            WHERE g.employee_id = ?
        `;
        let params = [req.user.id];
        
        if (cycle_id) {
            sql += ' AND g.cycle_id = ?';
            params.push(cycle_id);
        }
        
        const goals = await db.all(sql, params);
        
        // Calculate total weightage
        const totalWeightage = goals.reduce((sum, g) => sum + (g.weightage || 0), 0);
        
        res.json({ 
            goals,
            total_weightage: totalWeightage,
            goal_count: goals.length
        });
    } catch (error) {
        console.error('Get my goals error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get goals for approval (Manager view)
app.get('/api/goals/pending-approval', authenticateToken, authorizeRole('manager'), async (req, res) => {
    try {
        const { cycle_id } = req.query;
        
        let sql = `
            SELECT g.*, u.name as employee_name, u.email as employee_email, t.name as thrust_area_name
            FROM goals g
            JOIN users u ON g.employee_id = u.id
            LEFT JOIN thrust_areas t ON g.thrust_area_id = t.id
            WHERE u.manager_id = ? AND g.status IN ('submitted', 'rejected')
        `;
        let params = [req.user.id];
        
        if (cycle_id) {
            sql += ' AND g.cycle_id = ?';
            params.push(cycle_id);
        }
        
        const goals = await db.all(sql, params);
        res.json({ goals });
    } catch (error) {
        console.error('Get pending approval error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get team goals (Manager view)
app.get('/api/goals/team', authenticateToken, authorizeRole('manager'), async (req, res) => {
    try {
        const { cycle_id, employee_id } = req.query;
        
        let sql = `
            SELECT g.*, u.name as employee_name, t.name as thrust_area_name
            FROM goals g
            JOIN users u ON g.employee_id = u.id
            LEFT JOIN thrust_areas t ON g.thrust_area_id = t.id
            WHERE u.manager_id = ?
        `;
        let params = [req.user.id];
        
        if (cycle_id) {
            sql += ' AND g.cycle_id = ?';
            params.push(cycle_id);
        }
        
        if (employee_id) {
            sql += ' AND g.employee_id = ?';
            params.push(employee_id);
        }
        
        const goals = await db.all(sql, params);
        res.json({ goals });
    } catch (error) {
        console.error('Get team goals error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create goal
app.post('/api/goals', authenticateToken, authorizeRole('employee'), async (req, res) => {
    try {
        const { cycle_id, thrust_area_id, title, description, uom_type, target_value, weightage } = req.body;
        
        // Validation
        if (!title || !uom_type || !target_value || !weightage) {
            return res.status(400).json({ error: 'Title, UoM type, target value, and weightage are required' });
        }
        
        if (weightage < 10 || weightage > 100) {
            return res.status(400).json({ error: 'Weightage must be between 10% and 100%' });
        }
        
        // Check max goals limit
        const currentGoals = await db.all('SELECT id FROM goals WHERE employee_id = ? AND cycle_id = ?', 
            [req.user.id, cycle_id]);
        
        if (currentGoals.length >= 8) {
            return res.status(400).json({ error: 'Maximum 8 goals allowed per employee per cycle' });
        }
        
        const goalId = uuidv4();
        await db.run(`
            INSERT INTO goals (id, employee_id, cycle_id, thrust_area_id, title, description, uom_type, target_value, weightage, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')
        `, [goalId, req.user.id, cycle_id, thrust_area_id || null, title, description || null, uom_type, target_value, weightage]);
        
        await logAudit(req.user.id, 'CREATE', 'goal', goalId, null, req.body);
        
        res.status(201).json({ message: 'Goal created successfully', goal_id: goalId });
    } catch (error) {
        console.error('Create goal error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update goal (only in draft status)
app.put('/api/goals/:id', authenticateToken, async (req, res) => {
    try {
        const goal = await db.get('SELECT * FROM goals WHERE id = ?', [req.params.id]);
        
        if (!goal) {
            return res.status(404).json({ error: 'Goal not found' });
        }
        
        // Check permissions
        const canEdit = req.user.role === 'admin' || 
                       (req.user.role === 'employee' && goal.employee_id === req.user.id && goal.status === 'draft') ||
                       (req.user.role === 'manager' && goal.status === 'submitted');
        
        if (!canEdit) {
            return res.status(403).json({ error: 'Cannot edit this goal' });
        }
        
        const { thrust_area_id, title, description, uom_type, target_value, weightage } = req.body;
        
        if (weightage && (weightage < 10 || weightage > 100)) {
            return res.status(400).json({ error: 'Weightage must be between 10% and 100%' });
        }
        
        const oldValues = { ...goal };
        
        await db.run(`
            UPDATE goals 
            SET thrust_area_id = ?, title = ?, description = ?, uom_type = ?, target_value = ?, weightage = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [thrust_area_id || goal.thrust_area_id, title || goal.title, description ?? goal.description, 
            uom_type || goal.uom_type, target_value || goal.target_value, weightage || goal.weightage, req.params.id]);
        
        await logAudit(req.user.id, 'UPDATE', 'goal', req.params.id, oldValues, req.body);
        
        res.json({ message: 'Goal updated successfully' });
    } catch (error) {
        console.error('Update goal error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete goal (only in draft status)
app.delete('/api/goals/:id', authenticateToken, async (req, res) => {
    try {
        const goal = await db.get('SELECT * FROM goals WHERE id = ?', [req.params.id]);
        
        if (!goal) {
            return res.status(404).json({ error: 'Goal not found' });
        }
        
        if (goal.status !== 'draft' && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Cannot delete goal that is not in draft status' });
        }
        
        if (goal.employee_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: "Cannot delete another employee's goal" });
        }
        
        await db.run('DELETE FROM goals WHERE id = ?', [req.params.id]);
        await logAudit(req.user.id, 'DELETE', 'goal', req.params.id, goal, null);
        
        res.json({ message: 'Goal deleted successfully' });
    } catch (error) {
        console.error('Delete goal error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Submit goals for approval
app.post('/api/goals/submit', authenticateToken, authorizeRole('employee'), async (req, res) => {
    try {
        const { cycle_id } = req.body;
        
        if (!cycle_id) {
            return res.status(400).json({ error: 'Cycle ID is required' });
        }
        
        // Get all draft goals for this employee and cycle
        const goals = await db.all('SELECT * FROM goals WHERE employee_id = ? AND cycle_id = ? AND status = ?',
            [req.user.id, cycle_id, 'draft']);
        
        if (goals.length === 0) {
            return res.status(400).json({ error: 'No goals to submit' });
        }
        
        // Validate total weightage = 100%
        const totalWeightage = goals.reduce((sum, g) => sum + g.weightage, 0);
        if (totalWeightage !== 100) {
            return res.status(400).json({ 
                error: `Total weightage must be exactly 100%. Current total: ${totalWeightage}%` 
            });
        }
        
        // Update all goals to submitted status
        for (const goal of goals) {
            await db.run('UPDATE goals SET status = ? WHERE id = ?', ['submitted', goal.id]);
            await logAudit(req.user.id, 'SUBMIT', 'goal', goal.id, { status: 'draft' }, { status: 'submitted' });
        }
        
        res.json({ message: 'Goals submitted for approval successfully' });
    } catch (error) {
        console.error('Submit goals error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Approve/Reject goals (Manager)
app.post('/api/goals/approve', authenticateToken, authorizeRole('manager'), async (req, res) => {
    try {
        const { goal_id, action, updated_data } = req.body;
        
        if (!goal_id || !action) {
            return res.status(400).json({ error: 'Goal ID and action are required' });
        }
        
        if (!['approve', 'reject'].includes(action)) {
            return res.status(400).json({ error: 'Action must be approve or reject' });
        }
        
        const goal = await db.get(`
            SELECT g.*, u.manager_id 
            FROM goals g 
            JOIN users u ON g.employee_id = u.id 
            WHERE g.id = ?
        `, [goal_id]);
        
        if (!goal) {
            return res.status(404).json({ error: 'Goal not found' });
        }
        
        if (goal.manager_id !== req.user.id) {
            return res.status(403).json({ error: 'Not authorized to approve this goal' });
        }
        
        const oldValues = { ...goal };
        
        if (action === 'approve' && updated_data) {
            // Manager can edit targets/weightages during approval
            await db.run(`
                UPDATE goals 
                SET target_value = ?, weightage = ?, status = 'locked', updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [updated_data.target_value || goal.target_value, 
                updated_data.weightage || goal.weightage, goal_id]);
        } else if (action === 'approve') {
            await db.run("UPDATE goals SET status = 'locked' WHERE id = ?", [goal_id]);
        } else {
            await db.run("UPDATE goals SET status = 'rejected' WHERE id = ?", [goal_id]);
        }
        
        const newStatus = action === 'approve' ? 'locked' : 'rejected';
        await logAudit(req.user.id, action.toUpperCase(), 'goal', goal_id, oldValues, { status: newStatus, ...updated_data });
        
        res.json({ message: `Goal ${action}d successfully` });
    } catch (error) {
        console.error('Approve goal error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin: Unlock goal
app.post('/api/goals/unlock', authenticateToken, authorizeRole('admin'), async (req, res) => {
    try {
        const { goal_id } = req.body;
        
        const goal = await db.get('SELECT * FROM goals WHERE id = ?', [goal_id]);
        if (!goal) {
            return res.status(404).json({ error: 'Goal not found' });
        }
        
        const oldValues = { ...goal };
        await db.run("UPDATE goals SET status = 'submitted' WHERE id = ?", [goal_id]);
        
        await logAudit(req.user.id, 'UNLOCK', 'goal', goal_id, oldValues, { status: 'submitted' });
        
        res.json({ message: 'Goal unlocked successfully' });
    } catch (error) {
        console.error('Unlock goal error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Shared Goals: Assign goal to multiple employees
app.post('/api/goals/shared', authenticateToken, authorizeRole('admin', 'manager'), async (req, res) => {
    try {
        const { employee_ids, cycle_id, thrust_area_id, title, description, uom_type, target_value, weightage } = req.body;
        
        if (!employee_ids || !Array.isArray(employee_ids) || employee_ids.length === 0) {
            return res.status(400).json({ error: 'At least one employee ID is required' });
        }
        
        if (!title || !uom_type || !target_value) {
            return res.status(400).json({ error: 'Title, UoM type, and target value are required' });
        }
        
        const primaryOwnerId = employee_ids[0]; // First employee is primary owner
        
        for (const empId of employee_ids) {
            const goalId = uuidv4();
            const isReadonly = empId !== primaryOwnerId ? 1 : 0;
            
            await db.run(`
                INSERT INTO goals (id, employee_id, cycle_id, thrust_area_id, title, description, uom_type, target_value, weightage, status, is_shared, shared_by, is_readonly, primary_owner_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', 1, ?, ?, ?)
            `, [goalId, empId, cycle_id, thrust_area_id || null, title, description || null, 
                uom_type, target_value, weightage || 20, req.user.id, primaryOwnerId]);
        }
        
        res.json({ message: 'Shared goal created successfully' });
    } catch (error) {
        console.error('Create shared goal error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update achievement for a goal (Quarterly Check-in)
app.post('/api/goals/achievements', authenticateToken, async (req, res) => {
    try {
        const { goal_id, quarter, actual_achievement, status, employee_comment } = req.body;
        
        if (!goal_id || !quarter) {
            return res.status(400).json({ error: 'Goal ID and quarter are required' });
        }
        
        const goal = await db.get(`
            SELECT g.*, u.manager_id, u.id as employee_id
            FROM goals g
            JOIN users u ON g.employee_id = u.id
            WHERE g.id = ?
        `, [goal_id]);
        
        if (!goal) {
            return res.status(404).json({ error: 'Goal not found' });
        }
        
        // Only employee can update their achievements, or manager/admin
        const canUpdate = req.user.role === 'admin' || 
                         (req.user.role === 'employee' && goal.employee_id === req.user.id) ||
                         (req.user.role === 'manager' && goal.manager_id === req.user.id);
        
        if (!canUpdate) {
            return res.status(403).json({ error: 'Not authorized to update this achievement' });
        }
        
        // Calculate progress score based on UoM type
        let progressScore = null;
        if (actual_achievement !== null && actual_achievement !== undefined && actual_achievement !== '') {
            const target = parseFloat(goal.target_value);
            const actual = parseFloat(actual_achievement);
            
            if (!isNaN(target) && !isNaN(actual) && target !== 0) {
                switch (goal.uom_type) {
                    case 'numeric_min':
                    case 'percent_min':
                        // Higher is better
                        progressScore = Math.min((actual / target) * 100, 100);
                        break;
                    case 'numeric_max':
                    case 'percent_max':
                        // Lower is better
                        progressScore = target !== 0 ? Math.min((target / actual) * 100, 100) : 100;
                        break;
                    case 'zero':
                        // Zero = Success
                        progressScore = actual === 0 ? 100 : 0;
                        break;
                    case 'timeline':
                        // Date-based - simplified calculation
                        progressScore = status === 'completed' ? 100 : 50;
                        break;
                }
            }
        }
        
        const achievementId = uuidv4();
        const existingAchievement = await db.get(
            'SELECT * FROM goal_achievements WHERE goal_id = ? AND quarter = ?', 
            [goal_id, quarter]
        );
        
        if (existingAchievement) {
            await db.run(`
                UPDATE goal_achievements 
                SET actual_achievement = ?, status = ?, progress_score = ?, employee_comment = ?, updated_at = CURRENT_TIMESTAMP
                WHERE goal_id = ? AND quarter = ?
            `, [actual_achievement, status || 'not_started', progressScore, employee_comment || null, goal_id, quarter]);
        } else {
            await db.run(`
                INSERT INTO goal_achievements (id, goal_id, quarter, planned_target, actual_achievement, status, progress_score, employee_comment)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [achievementId, goal_id, quarter, goal.target_value, actual_achievement, 
                status || 'not_started', progressScore, employee_comment || null]);
        }
        
        await logAudit(req.user.id, 'UPDATE_ACHIEVEMENT', 'goal_achievement', goal_id, 
            existingAchievement, { actual_achievement, status, progress_score: progressScore });
        
        res.json({ message: 'Achievement updated successfully', progress_score: progressScore });
    } catch (error) {
        console.error('Update achievement error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get achievements for a goal
app.get('/api/goals/:id/achievements', authenticateToken, async (req, res) => {
    try {
        const achievements = await db.all(
            'SELECT * FROM goal_achievements WHERE goal_id = ? ORDER BY quarter', 
            [req.params.id]
        );
        res.json({ achievements });
    } catch (error) {
        console.error('Get achievements error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Manager Check-in
app.post('/api/checkins', authenticateToken, authorizeRole('manager'), async (req, res) => {
    try {
        const { employee_id, cycle_id, quarter, comments } = req.body;
        
        if (!employee_id || !cycle_id || !quarter) {
            return res.status(400).json({ error: 'Employee ID, cycle ID, and quarter are required' });
        }
        
        const checkinId = uuidv4();
        const existingCheckin = await db.get(
            'SELECT * FROM manager_checkins WHERE employee_id = ? AND cycle_id = ? AND quarter = ?',
            [employee_id, cycle_id, quarter]
        );
        
        if (existingCheckin) {
            await db.run(`
                UPDATE manager_checkins 
                SET comments = ?, status = 'completed', check_in_date = CURRENT_TIMESTAMP
                WHERE employee_id = ? AND cycle_id = ? AND quarter = ?
            `, [comments || null, employee_id, cycle_id, quarter]);
        } else {
            await db.run(`
                INSERT INTO manager_checkins (id, employee_id, cycle_id, quarter, comments, manager_id, status, check_in_date)
                VALUES (?, ?, ?, ?, ?, ?, 'completed', CURRENT_TIMESTAMP)
            `, [checkinId, employee_id, cycle_id, quarter, comments || null, req.user.id]);
        }
        
        await logAudit(req.user.id, 'CHECKIN', 'manager_checkin', employee_id, null, { cycle_id, quarter, comments });
        
        res.json({ message: 'Check-in completed successfully' });
    } catch (error) {
        console.error('Manager check-in error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get team check-in status (Manager Dashboard)
app.get('/api/checkins/team-status', authenticateToken, authorizeRole('manager'), async (req, res) => {
    try {
        const { cycle_id, quarter } = req.query;
        
        const teamMembers = await db.all(`
            SELECT u.id, u.name, u.email,
                   (SELECT COUNT(*) FROM goals g WHERE g.employee_id = u.id AND g.status = 'locked') as locked_goals,
                   (SELECT COUNT(*) FROM goal_achievements ga 
                    JOIN goals g ON ga.goal_id = g.id 
                    WHERE g.employee_id = u.id AND ga.quarter = ?) as achievements_submitted
            FROM users u
            WHERE u.manager_id = ?
        `, [quarter || 'Q1', req.user.id]);
        
        res.json({ team_members: teamMembers });
    } catch (error) {
        console.error('Get team status error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ==================== REPORTING ROUTES ====================

// Achievement Report (Export)
app.get('/api/reports/achievements', authenticateToken, async (req, res) => {
    try {
        const { cycle_id, quarter, employee_id, format } = req.query;
        
        let sql = `
            SELECT u.name as employee_name, u.email, u.department,
                   g.title as goal_title, g.target_value, g.uom_type, g.weightage,
                   ga.quarter, ga.actual_achievement, ga.progress_score, ga.status
            FROM goals g
            JOIN users u ON g.employee_id = u.id
            LEFT JOIN goal_achievements ga ON g.id = ga.goal_id
            WHERE 1=1
        `;
        let params = [];
        
        if (cycle_id) {
            sql += ' AND g.cycle_id = ?';
            params.push(cycle_id);
        }
        
        if (quarter) {
            sql += ' AND ga.quarter = ?';
            params.push(quarter);
        }
        
        if (employee_id) {
            sql += ' AND g.employee_id = ?';
            params.push(employee_id);
        }
        
        if (req.user.role === 'manager') {
            sql += ' AND u.manager_id = ?';
            params.push(req.user.id);
        } else if (req.user.role === 'employee') {
            sql += ' AND g.employee_id = ?';
            params.push(req.user.id);
        }
        
        sql += ' ORDER BY u.name, g.title, ga.quarter';
        
        const data = await db.all(sql, params);
        
        if (format === 'csv') {
            const headers = ['Employee Name', 'Email', 'Department', 'Goal Title', 'Target', 'UoM', 'Weightage', 'Quarter', 'Actual', 'Progress %', 'Status'];
            const csvRows = [headers.join(',')];
            
            data.forEach(row => {
                csvRows.push([
                    row.employee_name, row.email, row.department || '',
                    row.goal_title, row.target_value, row.uom_type, row.weightage,
                    row.quarter, row.actual_achievement || '', row.progress_score || '', row.status
                ].join(','));
            });
            
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="achievements_report.csv"');
            res.send(csvRows.join('\n'));
        } else {
            res.json({ report: data });
        }
    } catch (error) {
        console.error('Generate report error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Completion Dashboard
app.get('/api/reports/completion-dashboard', authenticateToken, async (req, res) => {
    try {
        const { cycle_id, quarter } = req.query;
        
        // Overall completion stats
        const stats = await db.get(`
            SELECT 
                (SELECT COUNT(DISTINCT g.employee_id) FROM goals g WHERE g.status = 'locked') as total_employees,
                (SELECT COUNT(DISTINCT g.employee_id) 
                 FROM goals g 
                 JOIN goal_achievements ga ON g.id = ga.goal_id 
                 WHERE ga.quarter = ?) as employees_with_achievements
        `, [quarter || 'Q1']);
        
        // Manager completion rates
        const managerStats = await db.all(`
            SELECT m.name as manager_name, 
                   COUNT(DISTINCT u.id) as team_size,
                   COUNT(DISTINCT ga.employee_id) as checkins_completed
            FROM users m
            JOIN users u ON u.manager_id = m.id
            LEFT JOIN goal_achievements ga ON u.id = (
                SELECT g.employee_id FROM goals g WHERE g.id = ga.goal_id
            ) AND ga.quarter = ?
            WHERE m.role = 'manager'
            GROUP BY m.id, m.name
        `, [quarter || 'Q1']);
        
        res.json({ stats, manager_stats: managerStats });
    } catch (error) {
        console.error('Get dashboard error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Audit Logs (Admin)
app.get('/api/reports/audit-logs', authenticateToken, authorizeRole('admin'), async (req, res) => {
    try {
        const { entity_type, entity_id, limit = 100 } = req.query;
        
        let sql = `
            SELECT a.*, u.name as user_name, u.email as user_email
            FROM audit_logs a
            JOIN users u ON a.user_id = u.id
            WHERE 1=1
        `;
        let params = [];
        
        if (entity_type) {
            sql += ' AND a.entity_type = ?';
            params.push(entity_type);
        }
        
        if (entity_id) {
            sql += ' AND a.entity_id = ?';
            params.push(entity_id);
        }
        
        sql += ' ORDER BY a.created_at DESC LIMIT ?';
        params.push(parseInt(limit));
        
        const logs = await db.all(sql, params);
        res.json({ audit_logs: logs });
    } catch (error) {
        console.error('Get audit logs error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ==================== ESCALATION ROUTES ====================

// Get escalations (Admin/Manager)
app.get('/api/escalations', authenticateToken, async (req, res) => {
    try {
        let sql = `
            SELECT e.*, t.name as triggered_by_name, u.name as target_user_name, u.email as target_user_email
            FROM escalations e
            JOIN users t ON e.triggered_by = t.id
            JOIN users u ON e.target_user_id = u.id
            WHERE e.status = 'pending'
        `;
        
        if (req.user.role === 'manager') {
            sql += ' AND e.target_user_id IN (SELECT id FROM users WHERE manager_id = ?)';
        }
        
        const escalations = await db.all(sql, req.user.role === 'manager' ? [req.user.id] : []);
        res.json({ escalations });
    } catch (error) {
        console.error('Get escalations error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Resolve escalation
app.patch('/api/escalations/:id/resolve', authenticateToken, async (req, res) => {
    try {
        const escalation = await db.get('SELECT * FROM escalations WHERE id = ?', [req.params.id]);
        
        if (!escalation) {
            return res.status(404).json({ error: 'Escalation not found' });
        }
        
        await db.run(`
            UPDATE escalations 
            SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [req.params.id]);
        
        res.json({ message: 'Escalation resolved' });
    } catch (error) {
        console.error('Resolve escalation error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ==================== ANALYTICS ROUTES ====================

app.get('/api/analytics/trends', authenticateToken, async (req, res) => {
    try {
        const { employee_id, department } = req.query;
        
        let sql = `
            SELECT ga.quarter, 
                   AVG(ga.progress_score) as avg_progress,
                   COUNT(*) as goal_count
            FROM goal_achievements ga
            JOIN goals g ON ga.goal_id = g.id
            JOIN users u ON g.employee_id = u.id
            WHERE 1=1
        `;
        let params = [];
        
        if (employee_id) {
            sql += ' AND g.employee_id = ?';
            params.push(employee_id);
        }
        
        if (department) {
            sql += ' AND u.department = ?';
            params.push(department);
        }
        
        sql += ' GROUP BY ga.quarter ORDER BY ga.quarter';
        
        const trends = await db.all(sql, params);
        
        // Goal distribution by thrust area
        const distribution = await db.all(`
            SELECT t.name as thrust_area, COUNT(*) as count
            FROM goals g
            LEFT JOIN thrust_areas t ON g.thrust_area_id = t.id
            GROUP BY t.name
        `);
        
        // UoM type breakdown
        const uomBreakdown = await db.all(`
            SELECT uom_type, COUNT(*) as count
            FROM goals
            GROUP BY uom_type
        `);
        
        res.json({ trends, distribution, uom_breakdown: uomBreakdown });
    } catch (error) {
        console.error('Get analytics error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ==================== CRON JOBS FOR ESCALATIONS ====================

// Daily escalation check
cron.schedule('0 9 * * *', async () => {
    console.log('Running daily escalation check...');
    
    try {
        const currentCycle = await db.get("SELECT * FROM goal_cycles WHERE status = 'active' LIMIT 1");
        if (!currentCycle) return;
        
        // Check for employees who haven't submitted goals
        const nonSubmitters = await db.all(`
            SELECT u.id, u.name, u.email, u.manager_id
            FROM users u
            WHERE u.role = 'employee'
            AND NOT EXISTS (
                SELECT 1 FROM goals g 
                WHERE g.employee_id = u.id 
                AND g.cycle_id = ? 
                AND g.status IN ('submitted', 'approved', 'locked')
            )
        `, [currentCycle.id]);
        
        for (const employee of nonSubmitters) {
            const escalationId = uuidv4();
            await db.run(`
                INSERT INTO escalations (id, rule_name, triggered_by, target_user_id, escalation_level, message)
                VALUES (?, 'Goal Submission Overdue', ?, ?, 1, ?)
            `, [escalationId, employee.manager_id, employee.id, 
                `Employee ${employee.name} has not submitted goals for ${currentCycle.name}`]);
        }
        
        // Check for managers who haven't approved goals
        const pendingApprovals = await db.all(`
            SELECT DISTINCT u.manager_id
            FROM goals g
            JOIN users u ON g.employee_id = u.id
            WHERE g.status = 'submitted'
            AND g.cycle_id = ?
        `, [currentCycle.id]);
        
        for (const { manager_id } of pendingApprovals) {
            const escalationId = uuidv4();
            const manager = await db.get('SELECT * FROM users WHERE id = ?', [manager_id]);
            if (manager) {
                await db.run(`
                    INSERT INTO escalations (id, rule_name, triggered_by, target_user_id, escalation_level, message)
                    VALUES (?, 'Goal Approval Overdue', ?, ?, 1, ?)
                `, [escalationId, manager.manager_id || 'admin', manager_id,
                    `Manager has pending goal approvals`]);
            }
        }
        
        console.log('Escalation check completed');
    } catch (error) {
        console.error('Escalation cron job error:', error);
    }
});

// Serve frontend - catch all route (Express 5 compatible)
app.get('/{*path}', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`\n=========================================`);
    console.log(`  ATOMQUEST Goal Tracker Portal`);
    console.log(`  Server running on port ${PORT}`);
    console.log(`  URL: http://localhost:${PORT}`);
    console.log(`=========================================\n`);
    console.log(`Default Admin Credentials:`);
    console.log(`  Email: admin@atomquest.com`);
    console.log(`  Password: admin123`);
    console.log(`\n`);
});

module.exports = app;
