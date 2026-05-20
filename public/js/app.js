// ATOMQUEST Goal Tracker - Frontend Application
// Professional UI/UX Implementation

class GoalTrackerApp {
    constructor() {
        this.currentUser = null;
        this.currentCycle = null;
        this.token = localStorage.getItem('authToken');
        this.init();
    }

    init() {
        if (this.token) {
            this.loadUserProfile();
        } else {
            this.showPage('login-page');
        }
        this.attachEventListeners();
    }

    // ==================== API Helper ====================
    async api(endpoint, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...(this.token && { 'Authorization': `Bearer ${this.token}` })
        };

        try {
            const response = await fetch(`/api${endpoint}`, {
                ...options,
                headers: { ...headers, ...options.headers }
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Request failed');
            }

            return data;
        } catch (error) {
            console.error('API Error:', error);
            this.showToast(error.message, 'error');
            throw error;
        }
    }

    // ==================== Authentication ====================
    async loadUserProfile() {
        try {
            const { user } = await this.api('/users/me');
            this.currentUser = user;
            this.setupDashboard();
            this.showPage('dashboard-page');
        } catch (error) {
            localStorage.removeItem('authToken');
            this.token = null;
            this.showPage('login-page');
        }
    }

    handleLogin(e) {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        this.api('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        })
        .then(({ token, user }) => {
            this.token = token;
            this.currentUser = user;
            localStorage.setItem('authToken', token);
            this.setupDashboard();
            this.showPage('dashboard-page');
            this.showToast(`Welcome back, ${user.name}!`, 'success');
        })
        .catch(() => {});
    }

    handleLogout() {
        localStorage.removeItem('authToken');
        this.token = null;
        this.currentUser = null;
        this.showPage('login-page');
        document.getElementById('login-form').reset();
    }

    // ==================== Page Navigation ====================
    showPage(pageId) {
        document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
        document.getElementById(pageId).classList.add('active');
    }

    switchView(viewName) {
        document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
        document.getElementById(`${viewName}-view`).classList.add('active');
        
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        document.querySelector(`[data-view="${viewName}"]`)?.classList.add('active');

        const titles = {
            goals: 'My Goals',
            achievements: 'Quarterly Achievements',
            checkins: 'Manager Check-ins',
            reports: 'Reports & Analytics',
            team: 'Team Overview',
            admin: 'Admin Panel',
            escalations: 'Escalations',
            analytics: 'Analytics Dashboard'
        };
        document.getElementById('page-title').textContent = titles[viewName] || 'Dashboard';

        // Load view-specific data
        this.loadViewData(viewName);
    }

    async loadViewData(viewName) {
        switch(viewName) {
            case 'goals':
                await this.loadGoals();
                break;
            case 'achievements':
                await this.loadAchievements();
                break;
            case 'checkins':
                await this.loadCheckIns();
                break;
            case 'team':
                await this.loadTeamOverview();
                break;
            case 'reports':
                await this.loadReports();
                break;
            case 'admin':
                await this.loadAdminPanel();
                break;
            case 'escalations':
                await this.loadEscalations();
                break;
            case 'analytics':
                await this.loadAnalytics();
                break;
        }
    }

    // ==================== Dashboard Setup ====================
    setupDashboard() {
        document.getElementById('user-name').textContent = this.currentUser.name;
        document.getElementById('user-role').textContent = this.currentUser.role;
        document.getElementById('user-role').className = `badge ${this.currentUser.role}`;

        // Role-based visibility
        document.querySelectorAll('.nav-manager-only').forEach(el => {
            el.style.display = ['manager', 'admin'].includes(this.currentUser.role) ? 'block' : 'none';
        });
        document.querySelectorAll('.nav-admin-only').forEach(el => {
            el.style.display = this.currentUser.role === 'admin' ? 'block' : 'none';
        });

        this.loadCycles();
    }

    async loadCycles() {
        try {
            const { cycles } = await this.api('/cycles');
            const select = document.getElementById('cycle-select');
            select.innerHTML = cycles.map(cycle => 
                `<option value="${cycle.id}" ${cycle.status === 'active' ? 'selected' : ''}>
                    ${cycle.name} (${cycle.year})
                </option>`
            ).join('');
            
            if (cycles.length > 0) {
                this.currentCycle = cycles.find(c => c.status === 'active') || cycles[0];
                this.loadGoals();
            }
        } catch (error) {
            console.error('Failed to load cycles:', error);
        }
    }

    // ==================== Goals Management ====================
    async loadGoals() {
        if (!this.currentCycle) return;

        try {
            const { goals, total_weightage, goal_count } = await this.api(
                `/goals/my-goals?cycle_id=${this.currentCycle.id}`
            );

            document.getElementById('total-weightage').textContent = `${total_weightage}%`;
            document.getElementById('goal-count').textContent = `${goal_count}/8`;
            
            const statusEl = document.getElementById('weightage-status');
            if (total_weightage === 100) {
                statusEl.textContent = '✓ Weightage is perfect';
                statusEl.className = 'success';
            } else {
                statusEl.textContent = `⚠ Needs ${100 - total_weightage}% more`;
                statusEl.className = 'error';
            }

            // Show/hide action buttons based on status
            const hasGoals = goals.length > 0;
            const allLocked = goals.every(g => g.status === 'locked');
            document.getElementById('add-goal-btn').style.display = 
                (goal_count < 8 && !allLocked) ? 'inline-block' : 'none';
            document.getElementById('submit-goals-btn').style.display = 
                (hasGoals && total_weightage === 100 && !allLocked) ? 'inline-block' : 'none';

            this.renderGoalsList(goals);
        } catch (error) {
            console.error('Failed to load goals:', error);
        }
    }

    renderGoalsList(goals) {
        const container = document.getElementById('goals-list');
        
        if (goals.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📋</div>
                    <h3>No Goals Yet</h3>
                    <p>Start by creating your first goal for this cycle.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = goals.map(goal => `
            <div class="card goal-card" data-id="${goal.id}">
                <div class="card-header">
                    <div class="card-title">${this.escapeHtml(goal.title)}</div>
                    <span class="card-status status-${goal.status}">${goal.status}</span>
                </div>
                <div class="card-body">
                    ${goal.thrust_area_name ? `
                        <div class="card-field">
                            <label>Thrust Area</label>
                            <value>${this.escapeHtml(goal.thrust_area_name)}</value>
                        </div>
                    ` : ''}
                    ${goal.description ? `
                        <div class="card-field">
                            <label>Description</label>
                            <value>${this.escapeHtml(goal.description)}</value>
                        </div>
                    ` : ''}
                    <div class="card-field">
                        <label>Unit of Measurement</label>
                        <value>${this.formatUoMType(goal.uom_type)}</value>
                    </div>
                    <div class="card-field">
                        <label>Target</label>
                        <value>${goal.target_value}</value>
                    </div>
                    <div class="card-field">
                        <label>Weightage</label>
                        <value>${goal.weightage}%</value>
                    </div>
                    ${goal.primary_owner_name && goal.primary_owner_name !== this.currentUser.name ? `
                        <div class="card-field">
                            <label>Primary Owner</label>
                            <value>${this.escapeHtml(goal.primary_owner_name)}</value>
                        </div>
                    ` : ''}
                </div>
                <div class="card-actions">
                    ${goal.status === 'draft' ? `
                        <button class="btn btn-sm btn-primary" onclick="app.editGoal('${goal.id}')">Edit</button>
                        <button class="btn btn-sm btn-danger" onclick="app.deleteGoal('${goal.id}')">Delete</button>
                    ` : ''}
                    ${['submitted', 'rejected'].includes(goal.status) && this.currentUser.role === 'manager' ? `
                        <button class="btn btn-sm btn-success" onclick="app.approveGoal('${goal.id}')">Approve</button>
                        <button class="btn btn-sm btn-danger" onclick="app.rejectGoal('${goal.id}')">Reject</button>
                    ` : ''}
                    ${goal.status === 'locked' ? `
                        <span class="lock-indicator">🔒 Locked</span>
                    ` : ''}
                </div>
            </div>
        `).join('');
    }

    openAddGoalModal() {
        const modalContent = `
            <h2>Add New Goal</h2>
            <form id="goal-form" class="modal-form">
                <input type="hidden" id="goal-id" value="">
                
                <div class="form-group">
                    <label for="goal-thrust-area">Thrust Area</label>
                    <select id="goal-thrust-area" required>
                        <option value="">Select Thrust Area</option>
                    </select>
                </div>

                <div class="form-group">
                    <label for="goal-title">Goal Title *</label>
                    <input type="text" id="goal-title" required placeholder="Enter goal title">
                </div>

                <div class="form-group">
                    <label for="goal-description">Description</label>
                    <textarea id="goal-description" rows="3" placeholder="Describe the goal"></textarea>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label for="goal-uom">Unit of Measurement *</label>
                        <select id="goal-uom" required onchange="app.updateTargetLabel()">
                            <option value="">Select UoM</option>
                            <option value="numeric_min">Numeric (Higher is better)</option>
                            <option value="numeric_max">Numeric (Lower is better)</option>
                            <option value="percent_min">Percentage (Higher is better)</option>
                            <option value="percent_max">Percentage (Lower is better)</option>
                            <option value="timeline">Timeline (Date-based)</option>
                            <option value="zero">Zero-based (Zero = Success)</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label for="goal-target" id="target-label">Target Value *</label>
                        <input type="text" id="goal-target" required placeholder="Enter target">
                    </div>
                </div>

                <div class="form-group">
                    <label for="goal-weightage">Weightage (%) *</label>
                    <input type="number" id="goal-weightage" min="10" max="100" required 
                           placeholder="Min 10%" value="10">
                    <small>Minimum 10%, Maximum 100%</small>
                </div>

                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
                    <button type="submit" class="btn btn-primary">Save Goal</button>
                </div>
            </form>
        `;

        this.openModal(modalContent);
        this.loadThrustAreas();
        
        document.getElementById('goal-form').addEventListener('submit', (e) => this.handleGoalSubmit(e));
    }

    async loadThrustAreas() {
        try {
            const { thrust_areas } = await this.api('/thrust-areas');
            const select = document.getElementById('goal-thrust-area');
            select.innerHTML = '<option value="">Select Thrust Area</option>' +
                thrust_areas.map(area => 
                    `<option value="${area.id}">${this.escapeHtml(area.name)}</option>`
                ).join('');
        } catch (error) {
            console.error('Failed to load thrust areas:', error);
        }
    }

    updateTargetLabel() {
        const uomType = document.getElementById('goal-uom').value;
        const label = document.getElementById('target-label');
        
        const labels = {
            numeric_min: 'Target Value (e.g., 1000 units)',
            numeric_max: 'Target Value (e.g., 5 days TAT)',
            percent_min: 'Target Percentage (e.g., 95%)',
            percent_max: 'Target Percentage (e.g., < 5%)',
            timeline: 'Target Date (YYYY-MM-DD)',
            zero: 'Expected Value (0 for success)'
        };
        
        label.textContent = (labels[uomType] || 'Target Value *') + ' *';
    }

    async handleGoalSubmit(e) {
        e.preventDefault();
        
        const goalId = document.getElementById('goal-id').value;
        const data = {
            cycle_id: this.currentCycle.id,
            thrust_area_id: document.getElementById('goal-thrust-area').value || null,
            title: document.getElementById('goal-title').value,
            description: document.getElementById('goal-description').value,
            uom_type: document.getElementById('goal-uom').value,
            target_value: document.getElementById('goal-target').value,
            weightage: parseFloat(document.getElementById('goal-weightage').value)
        };

        try {
            if (goalId) {
                await this.api(`/goals/${goalId}`, {
                    method: 'PUT',
                    body: JSON.stringify(data)
                });
                this.showToast('Goal updated successfully', 'success');
            } else {
                await this.api('/goals', {
                    method: 'POST',
                    body: JSON.stringify(data)
                });
                this.showToast('Goal created successfully', 'success');
            }
            this.closeModal();
            this.loadGoals();
        } catch (error) {
            console.error('Failed to save goal:', error);
        }
    }

    async editGoal(goalId) {
        try {
            const { goals } = await this.api('/goals/my-goals');
            const goal = goals.find(g => g.id === goalId);
            if (!goal) return;

            this.openAddGoalModal();
            
            setTimeout(() => {
                document.getElementById('goal-id').value = goal.id;
                document.getElementById('goal-thrust-area').value = goal.thrust_area_id || '';
                document.getElementById('goal-title').value = goal.title;
                document.getElementById('goal-description').value = goal.description || '';
                document.getElementById('goal-uom').value = goal.uom_type;
                document.getElementById('goal-target').value = goal.target_value;
                document.getElementById('goal-weightage').value = goal.weightage;
                this.updateTargetLabel();
            }, 100);
        } catch (error) {
            console.error('Failed to load goal:', error);
        }
    }

    async deleteGoal(goalId) {
        if (!confirm('Are you sure you want to delete this goal?')) return;

        try {
            await this.api(`/goals/${goalId}`, { method: 'DELETE' });
            this.showToast('Goal deleted successfully', 'success');
            this.loadGoals();
        } catch (error) {
            console.error('Failed to delete goal:', error);
        }
    }

    async submitGoals() {
        if (!confirm('Submit all goals for approval? You won\'t be able to edit them after submission.')) return;

        try {
            await this.api('/goals/submit-all', {
                method: 'POST',
                body: JSON.stringify({ cycle_id: this.currentCycle.id })
            });
            this.showToast('Goals submitted for approval', 'success');
            this.loadGoals();
        } catch (error) {
            console.error('Failed to submit goals:', error);
        }
    }

    async approveGoal(goalId) {
        try {
            await this.api(`/goals/${goalId}/approve`, {
                method: 'POST',
                body: JSON.stringify({})
            });
            this.showToast('Goal approved successfully', 'success');
            this.loadGoals();
        } catch (error) {
            console.error('Failed to approve goal:', error);
        }
    }

    async rejectGoal(goalId) {
        const reason = prompt('Enter rejection reason:');
        if (!reason) return;

        try {
            await this.api(`/goals/${goalId}/reject`, {
                method: 'POST',
                body: JSON.stringify({ rejection_reason: reason })
            });
            this.showToast('Goal rejected', 'info');
            this.loadGoals();
        } catch (error) {
            console.error('Failed to reject goal:', error);
        }
    }

    // ==================== Achievements ====================
    async loadAchievements() {
        const quarter = document.getElementById('quarter-select').value;
        
        try {
            const { goals } = await this.api(`/goals/my-goals?cycle_id=${this.currentCycle.id}`);
            const lockedGoals = goals.filter(g => g.status === 'locked');

            if (lockedGoals.length === 0) {
                document.getElementById('achievements-list').innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">📊</div>
                        <h3>No Approved Goals</h3>
                        <p>Your goals need to be approved before you can track achievements.</p>
                    </div>
                `;
                return;
            }

            // Load achievements for each goal
            const achievementsData = await Promise.all(
                lockedGoals.map(async goal => {
                    try {
                        const { achievements } = await this.api(`/goals/${goal.id}/achievements`);
                        return { goal, achievements };
                    } catch {
                        return { goal, achievements: [] };
                    }
                })
            );

            document.getElementById('achievements-list').innerHTML = achievementsData.map(({ goal, achievements }) => {
                const quarterAchievement = achievements.find(a => a.quarter === quarter) || {};
                
                return `
                    <div class="card achievement-card">
                        <div class="card-header">
                            <div class="card-title">${this.escapeHtml(goal.title)}</div>
                            <span class="card-status status-${goal.status}">Approved</span>
                        </div>
                        <div class="card-body">
                            <div class="card-field">
                                <label>Target</label>
                                <value>${goal.target_value} (${goal.uom_type})</value>
                            </div>
                            <div class="achievement-inputs">
                                <div class="form-group">
                                    <label>Actual Achievement</label>
                                    <input type="text" 
                                           id="actual-${goal.id}" 
                                           value="${quarterAchievement.actual_achievement || ''}"
                                           placeholder="Enter actual value">
                                </div>
                                <div class="form-group">
                                    <label>Status</label>
                                    <select id="status-${goal.id}" class="status-select">
                                        <option value="not_started" ${quarterAchievement.status === 'not_started' ? 'selected' : ''}>Not Started</option>
                                        <option value="in_progress" ${quarterAchievement.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
                                        <option value="on_track" ${quarterAchievement.status === 'on_track' ? 'selected' : ''}>On Track</option>
                                        <option value="completed" ${quarterAchievement.status === 'completed' ? 'selected' : ''}>Completed</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>Comments</label>
                                    <textarea id="comment-${goal.id}" rows="2" 
                                              placeholder="Add any comments">${quarterAchievement.employee_comment || ''}</textarea>
                                </div>
                                ${quarterAchievement.progress_score !== undefined ? `
                                    <div class="progress-bar-container">
                                        <label>Progress Score</label>
                                        <div class="progress-bar">
                                            <div class="progress-fill" style="width: ${quarterAchievement.progress_score}%"></div>
                                        </div>
                                        <small>${Math.round(quarterAchievement.progress_score)}% achieved</small>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                        <div class="card-actions">
                            <button class="btn btn-primary btn-sm" 
                                    onclick="app.saveAchievement('${goal.id}', '${quarter}')">
                                Save ${quarter} Update
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (error) {
            console.error('Failed to load achievements:', error);
        }
    }

    async saveAchievement(goalId, quarter) {
        const actual = document.getElementById(`actual-${goalId}`).value;
        const status = document.getElementById(`status-${goalId}`).value;
        const comment = document.getElementById(`comment-${goalId}`).value;

        if (!actual) {
            this.showToast('Please enter actual achievement value', 'error');
            return;
        }

        try {
            await this.api('/goals/achievements', {
                method: 'POST',
                body: JSON.stringify({
                    goal_id: goalId,
                    quarter,
                    actual_achievement: actual,
                    status,
                    employee_comment: comment
                })
            });
            this.showToast(`${quarter} achievement saved successfully`, 'success');
            this.loadAchievements();
        } catch (error) {
            console.error('Failed to save achievement:', error);
        }
    }

    // ==================== Check-ins ====================
    async loadCheckIns() {
        try {
            let content = '';
            
            if (this.currentUser.role === 'employee') {
                const { checkins } = await this.api(`/checkins/my-checkins?cycle_id=${this.currentCycle.id}`);
                
                if (checkins.length === 0) {
                    content = `
                        <div class="empty-state">
                            <div class="empty-icon">💬</div>
                            <h3>No Check-ins Yet</h3>
                            <p>Your manager hasn't scheduled any check-in meetings yet.</p>
                        </div>
                    `;
                } else {
                    content = `
                        <div class="table-container">
                            <table class="table">
                                <thead>
                                    <tr>
                                        <th>Quarter</th>
                                        <th>Date</th>
                                        <th>Manager Comments</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${checkins.map(checkin => `
                                        <tr>
                                            <td>${checkin.quarter}</td>
                                            <td>${new Date(checkin.check_in_date).toLocaleDateString()}</td>
                                            <td>${checkin.comments || '-'}</td>
                                            <td><span class="badge ${checkin.status}">${checkin.status}</span></td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    `;
                }
            } else if (this.currentUser.role === 'manager') {
                const { team_members } = await this.api('/checkins/team-status');
                
                content = `
                    <div class="checkin-grid">
                        ${team_members.map(member => `
                            <div class="card team-member-card">
                                <div class="card-header">
                                    <div class="card-title">${this.escapeHtml(member.name)}</div>
                                    <span class="badge employee">${member.email}</span>
                                </div>
                                <div class="card-body">
                                    <div class="stats-row">
                                        <div class="stat-item">
                                            <label>Locked Goals</label>
                                            <value>${member.locked_goals}</value>
                                        </div>
                                        <div class="stat-item">
                                            <label>Achievements Submitted</label>
                                            <value>${member.achievements_submitted}</value>
                                        </div>
                                    </div>
                                </div>
                                <div class="card-actions">
                                    <button class="btn btn-primary btn-sm" 
                                            onclick="app.openCheckInModal('${member.id}', '${member.name}')">
                                        Conduct Check-in
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
            }

            document.getElementById('checkins-content').innerHTML = content;
        } catch (error) {
            console.error('Failed to load check-ins:', error);
        }
    }

    openCheckInModal(employeeId, employeeName) {
        const modalContent = `
            <h2>Check-in: ${this.escapeHtml(employeeName)}</h2>
            <form id="checkin-form" class="modal-form">
                <input type="hidden" id="checkin-employee-id" value="${employeeId}">
                
                <div class="form-group">
                    <label>Quarter</label>
                    <select id="checkin-quarter" required>
                        <option value="Q1">Q1 (July)</option>
                        <option value="Q2">Q2 (October)</option>
                        <option value="Q3">Q3 (January)</option>
                        <option value="Q4">Q4 (March/April)</option>
                    </select>
                </div>

                <div class="form-group">
                    <label>Discussion Notes</label>
                    <textarea id="checkin-comments" rows="5" 
                              placeholder="Document the discussion points, feedback, and action items..."></textarea>
                </div>

                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
                    <button type="submit" class="btn btn-primary">Complete Check-in</button>
                </div>
            </form>
        `;

        this.openModal(modalContent);
        document.getElementById('checkin-form').addEventListener('submit', (e) => this.handleCheckInSubmit(e));
    }

    async handleCheckInSubmit(e) {
        e.preventDefault();
        
        try {
            await this.api('/checkins', {
                method: 'POST',
                body: JSON.stringify({
                    employee_id: document.getElementById('checkin-employee-id').value,
                    cycle_id: this.currentCycle.id,
                    quarter: document.getElementById('checkin-quarter').value,
                    comments: document.getElementById('checkin-comments').value
                })
            });
            this.showToast('Check-in completed successfully', 'success');
            this.closeModal();
            this.loadCheckIns();
        } catch (error) {
            console.error('Failed to complete check-in:', error);
        }
    }

    // ==================== Team Overview ====================
    async loadTeamOverview() {
        try {
            const { goals } = await this.api('/goals/team');
            
            // Group by employee
            const employeeGoals = goals.reduce((acc, goal) => {
                if (!acc[goal.employee_name]) {
                    acc[goal.employee_name] = { goals: [], total: 0, locked: 0 };
                }
                acc[goal.employee_name].goals.push(goal);
                acc[goal.employee_name].total += goal.weightage;
                if (goal.status === 'locked') acc[goal.employee_name].locked++;
                return acc;
            }, {});

            document.getElementById('team-content').innerHTML = Object.entries(employeeGoals).map(([name, data]) => `
                <div class="card team-card">
                    <div class="card-header">
                        <div class="card-title">${this.escapeHtml(name)}</div>
                        <span class="card-status status-${data.locked > 0 ? 'approved' : 'draft'}">
                            ${data.locked}/${data.goals.length} Approved
                        </span>
                    </div>
                    <div class="card-body">
                        <div class="card-field">
                            <label>Total Goals</label>
                            <value>${data.goals.length}</value>
                        </div>
                        <div class="card-field">
                            <label>Weightage</label>
                            <value>${data.total}%</value>
                        </div>
                    </div>
                    <div class="card-actions">
                        <button class="btn btn-info btn-sm" onclick="app.viewEmployeeGoals('${name}')">
                            View Details
                        </button>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Failed to load team overview:', error);
        }
    }

    // ==================== Reports ====================
    async loadReports() {
        document.getElementById('reports-content').innerHTML = `
            <div class="report-cards">
                <div class="report-card">
                    <h3>Achievement Report</h3>
                    <p>Export planned vs actual achievements for all employees</p>
                    <button class="btn btn-primary" onclick="app.exportReport('achievements')">
                        📥 Export CSV
                    </button>
                </div>
                <div class="report-card">
                    <h3>Completion Dashboard</h3>
                    <p>View check-in completion rates across teams</p>
                    <button class="btn btn-info" onclick="app.showCompletionDashboard()">
                        📊 View Dashboard
                    </button>
                </div>
                <div class="report-card">
                    <h3>Audit Logs</h3>
                    <p>Track all changes made to goals and achievements</p>
                    <button class="btn btn-secondary" onclick="app.viewAuditLogs()">
                        📜 View Logs
                    </button>
                </div>
            </div>
        `;
    }

    async exportReport(type) {
        try {
            const data = await this.api(`/reports/${type}?format=csv&cycle_id=${this.currentCycle.id}`);
            // Handle download
            this.showToast('Report generated successfully', 'success');
        } catch (error) {
            console.error('Failed to export report:', error);
        }
    }

    async showCompletionDashboard() {
        try {
            const { completion_data } = await this.api('/reports/completion-dashboard');
            // Render dashboard
            this.showToast('Completion dashboard loaded', 'success');
        } catch (error) {
            console.error('Failed to load dashboard:', error);
        }
    }

    async viewAuditLogs() {
        try {
            const { logs } = await this.api('/audit-logs?limit=50');
            const modalContent = `
                <h2>Audit Logs</h2>
                <div class="table-container">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>User</th>
                                <th>Action</th>
                                <th>Entity</th>
                                <th>Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${logs.map(log => `
                                <tr>
                                    <td>${new Date(log.created_at).toLocaleString()}</td>
                                    <td>${this.escapeHtml(log.user_name)}</td>
                                    <td>${log.action}</td>
                                    <td>${log.entity_type}: ${log.entity_id}</td>
                                    <td><small>${log.old_values ? 'Modified' : 'Created'}</small></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
            this.openModal(modalContent);
        } catch (error) {
            console.error('Failed to load audit logs:', error);
        }
    }

    // ==================== Admin Panel ====================
    async loadAdminPanel() {
        // Load users
        try {
            const { users } = await this.api('/users');
            document.getElementById('users-list').innerHTML = `
                <table class="table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Role</th>
                            <th>Department</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${users.map(user => `
                            <tr>
                                <td>${this.escapeHtml(user.name)}</td>
                                <td>${user.email}</td>
                                <td><span class="badge ${user.role}">${user.role}</span></td>
                                <td>${user.department || '-'}</td>
                                <td>
                                    <button class="btn btn-sm btn-secondary" onclick="app.editUser('${user.id}')">Edit</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        } catch (error) {
            console.error('Failed to load users:', error);
        }

        // Load cycles
        try {
            const { cycles } = await this.api('/cycles');
            document.getElementById('cycles-list').innerHTML = cycles.map(cycle => `
                <div class="card cycle-card">
                    <div class="card-header">
                        <div class="card-title">${cycle.name} (${cycle.year})</div>
                        <span class="card-status status-${cycle.status}">${cycle.status}</span>
                    </div>
                    <div class="card-body">
                        <div class="card-field">
                            <label>Period</label>
                            <value>${new Date(cycle.start_date).toLocaleDateString()} - ${new Date(cycle.end_date).toLocaleDateString()}</value>
                        </div>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Failed to load cycles:', error);
        }
    }

    // ==================== Escalations ====================
    async loadEscalations() {
        try {
            const { escalations } = await this.api('/escalations');
            
            if (escalations.length === 0) {
                document.getElementById('escalations-list').innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">✅</div>
                        <h3>All Caught Up!</h3>
                        <p>No pending escalations at the moment.</p>
                    </div>
                `;
                return;
            }

            document.getElementById('escalations-list').innerHTML = escalations.map(esc => `
                <div class="card escalation-card">
                    <div class="card-header">
                        <div class="card-title">${esc.type}</div>
                        <span class="card-status status-${esc.priority}">${esc.priority}</span>
                    </div>
                    <div class="card-body">
                        <div class="card-field">
                            <label>Description</label>
                            <value>${esc.description}</value>
                        </div>
                        <div class="card-field">
                            <label>Created</label>
                            <value>${new Date(esc.created_at).toLocaleString()}</value>
                        </div>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Failed to load escalations:', error);
        }
    }

    // ==================== Analytics ====================
    async loadAnalytics() {
        try {
            const { analytics } = await this.api('/analytics/dashboard');
            
            document.getElementById('trends-chart').innerHTML = `
                <div class="chart-placeholder">
                    <p>QoQ Achievement Trends Chart</p>
                    <div class="mock-chart">
                        <div class="bar" style="height: 60%">Q1</div>
                        <div class="bar" style="height: 75%">Q2</div>
                        <div class="bar" style="height: 85%">Q3</div>
                        <div class="bar" style="height: 90%">Q4</div>
                    </div>
                </div>
            `;

            document.getElementById('distribution-chart').innerHTML = `
                <div class="chart-placeholder">
                    <p>Goal Distribution by Thrust Area</p>
                    <div class="pie-chart-mock"></div>
                </div>
            `;

            document.getElementById('uom-chart').innerHTML = `
                <div class="chart-placeholder">
                    <p>UoM Type Breakdown</p>
                    <ul class="distribution-list">
                        <li>Numeric: 45%</li>
                        <li>Percentage: 30%</li>
                        <li>Timeline: 15%</li>
                        <li>Zero-based: 10%</li>
                    </ul>
                </div>
            `;
        } catch (error) {
            console.error('Failed to load analytics:', error);
        }
    }

    // ==================== Modal Management ====================
    openModal(content) {
        document.getElementById('modal-body').innerHTML = content;
        document.getElementById('modal').classList.add('active');
    }

    closeModal() {
        document.getElementById('modal').classList.remove('active');
    }

    // ==================== Toast Notifications ====================
    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast ${type} show`;
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    // ==================== Utility Functions ====================
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatUoMType(uomType) {
        const types = {
            numeric_min: 'Numeric (Higher is better)',
            numeric_max: 'Numeric (Lower is better)',
            percent_min: 'Percentage (Higher is better)',
            percent_max: 'Percentage (Lower is better)',
            timeline: 'Timeline',
            zero: 'Zero-based'
        };
        return types[uomType] || uomType;
    }

    // ==================== Event Listeners ====================
    attachEventListeners() {
        // Login form
        document.getElementById('login-form').addEventListener('submit', (e) => this.handleLogin(e));

        // Logout
        document.getElementById('logout-btn').addEventListener('click', () => this.handleLogout());

        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const view = item.dataset.view;
                if (view) this.switchView(view);
            });
        });

        // Goal actions
        document.getElementById('add-goal-btn').addEventListener('click', () => this.openAddGoalModal());
        document.getElementById('submit-goals-btn').addEventListener('click', () => this.submitGoals());

        // Quarter change
        document.getElementById('quarter-select').addEventListener('change', () => this.loadAchievements());

        // Cycle change
        document.getElementById('cycle-select').addEventListener('change', (e) => {
            this.currentCycle = { id: e.target.value };
            this.loadGoals();
        });

        // Modal close
        document.querySelector('.modal-close').addEventListener('click', () => this.closeModal());
        document.getElementById('modal').addEventListener('click', (e) => {
            if (e.target.id === 'modal') this.closeModal();
        });

        // Admin buttons
        document.getElementById('create-user-btn')?.addEventListener('click', () => {
            this.showToast('User creation feature coming soon', 'info');
        });
        document.getElementById('create-cycle-btn')?.addEventListener('click', () => {
            this.showToast('Cycle creation feature coming soon', 'info');
        });
        document.getElementById('view-audit-btn')?.addEventListener('click', () => this.viewAuditLogs());
        document.getElementById('create-shared-goal-btn')?.addEventListener('click', () => {
            this.showToast('Shared goal creation feature coming soon', 'info');
        });

        // Export buttons
        document.getElementById('export-csv-btn')?.addEventListener('click', () => this.exportReport('achievements'));
        document.getElementById('completion-dashboard-btn')?.addEventListener('click', () => this.showCompletionDashboard());
    }
}

// Initialize app
const app = new GoalTrackerApp();
