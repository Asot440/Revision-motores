const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');

const app = express();
const db = new sqlite3.Database(path.join(__dirname, 'database.db'));
const PORT = process.env.PORT || 3000;
const BCRYPT_ROUNDS = 12;
const ALLOWED_AREAS = ['Central de pastas', 'Máquina no. 2', 'Máquina no. 3'];

const ROLE_PERMISSIONS = {
    admin: [
        'users:create',
        'users:read',
        'motors:create',
        'motors:read',
        'inspections:create',
        'reports:read'
    ],
    supervisor: [
        'users:read',
        'motors:create',
        'motors:read',
        'inspections:create',
        'reports:read'
    ],
    technician: [
        'motors:read',
        'inspections:create'
    ],
    viewer: [
        'motors:read',
        'reports:read'
    ]
};

app.use(express.static(path.join(__dirname, 'public')));
app.use('/img', express.static(path.join(__dirname, 'img')));
app.use(express.json());
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'API Docs - Sistema de Monitoreo'
}));
app.get('/api-docs.json', (req, res) => {
    res.json(swaggerSpec);
});

function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) {
                reject(err);
                return;
            }

            resolve(this);
        });
    });
}

function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) {
                reject(err);
                return;
            }

            resolve(row);
        });
    });
}

function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) {
                reject(err);
                return;
            }

            resolve(rows);
        });
    });
}

function normalizeRole(role) {
    return ROLE_PERMISSIONS[role] ? role : 'viewer';
}

function normalizeArea(area) {
    const areaMap = {
        'Maquina 2': 'Máquina no. 2',
        'Máquina 2': 'Máquina no. 2',
        'Maquina no. 2': 'Máquina no. 2',
        'Maquina 3': 'Máquina no. 3',
        'Máquina 3': 'Máquina no. 3',
        'Maquina no. 3': 'Máquina no. 3',
        'Central de pastas': 'Central de pastas'
    };

    return areaMap[area] || area;
}

function getLocalDateTime() {
    const now = new Date();
    const offsetMs = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offsetMs).toISOString().slice(0, 19).replace('T', ' ');
}

function normalizePermissions(role, permissions) {
    if (Array.isArray(permissions) && permissions.length > 0) {
        return permissions;
    }

    return ROLE_PERMISSIONS[normalizeRole(role)];
}

function parsePermissions(value, role) {
    try {
        return normalizePermissions(role, JSON.parse(value || '[]'));
    } catch {
        return ROLE_PERMISSIONS[normalizeRole(role)];
    }
}

function publicUser(user) {
    const role = normalizeRole(user.role);

    return {
        id: user.id,
        username: user.username,
        role,
        permissions: parsePermissions(user.permissions, role)
    };
}

async function ensureColumn(table, column, definition) {
    const columns = await dbAll(`PRAGMA table_info(${table})`);
    const exists = columns.some((item) => item.name === column);

    if (!exists) {
        await dbRun(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
}

async function initializeDatabase() {
    await dbRun(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT,
            password_hash TEXT,
            role TEXT DEFAULT 'viewer',
            permissions TEXT DEFAULT '[]'
        )
    `);

    await ensureColumn('users', 'password_hash', 'TEXT');
    await ensureColumn('users', 'role', `TEXT DEFAULT 'viewer'`);
    await ensureColumn('users', 'permissions', `TEXT DEFAULT '[]'`);

    await dbRun(`
        CREATE TABLE IF NOT EXISTS motors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            equipment_key TEXT UNIQUE,
            name TEXT,
            area TEXT,
            critical INTEGER DEFAULT 0
        )
    `);

    await ensureColumn('motors', 'equipment_key', 'TEXT');
    await ensureColumn('motors', 'active', 'INTEGER DEFAULT 1');
    await ensureColumn('motors', 'nominal_current', 'REAL');

    await dbRun(`
        UPDATE motors
        SET area = CASE
            WHEN area IN ('Maquina 2', 'Máquina 2', 'Máquina no. 2') THEN 'Máquina no. 2'
            WHEN area IN ('Maquina 3', 'Máquina 3', 'Máquina no. 3') THEN 'Máquina no. 3'
            WHEN area IN ('Central de pastas') THEN 'Central de pastas'
            ELSE area
        END
    `);

    await dbRun(`
        DELETE FROM motors
        WHERE equipment_key IS NOT NULL
            AND id NOT IN (
                SELECT MIN(id)
                FROM motors
                WHERE equipment_key IS NOT NULL
                GROUP BY equipment_key
            )
    `);

    await dbRun(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_motors_equipment_key
        ON motors(equipment_key)
        WHERE equipment_key IS NOT NULL
    `);

    await dbRun(`
        CREATE TABLE IF NOT EXISTS inspections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            date TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await dbRun(`
        CREATE TABLE IF NOT EXISTS inspection_details (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            inspection_id INTEGER,
            motor_id INTEGER,
            temperature REAL,
            current REAL,
            dirty INTEGER,
            noise INTEGER,
            vibration INTEGER,
            comments TEXT
        )
    `);

    await ensureColumn('inspection_details', 'cleaning_required', 'INTEGER DEFAULT 0');
    await ensureColumn('inspection_details', 'equipment_stopped', 'INTEGER DEFAULT 0');
    await ensureColumn('inspection_details', 'action_taken', 'TEXT');
    await ensureColumn('inspection_details', 'finding_closed', 'INTEGER DEFAULT 0');
    await ensureColumn('inspection_details', 'closed_at', 'TEXT');
    await ensureColumn('inspection_details', 'closed_by', 'INTEGER');
    await ensureColumn('inspection_details', 'current_user_id', 'INTEGER');
    await ensureColumn('inspection_details', 'current_recorded_at', 'TEXT');
    await ensureColumn('inspection_details', 'physical_user_id', 'INTEGER');
    await ensureColumn('inspection_details', 'physical_recorded_at', 'TEXT');

    await dbRun(`
        UPDATE inspection_details
        SET cleaning_required = dirty
        WHERE cleaning_required IS NULL
    `);

    await dbRun(`
        INSERT OR IGNORE INTO motors(equipment_key, name, area, critical, active)
        VALUES
            ('MP2-010', 'M.B. Vacio no. 1', 'Máquina no. 2', 1, 1),
            ('MP2-011', 'M.B. Vacio no. 2', 'Máquina no. 2', 1, 1),
            ('CP-001', 'Bomba central de pastas', 'Central de pastas', 0, 1)
    `);

    const adminPermissions = JSON.stringify(ROLE_PERMISSIONS.admin);
    const admin = await dbGet(`SELECT * FROM users WHERE username = ?`, ['admin']);

    if (!admin) {
        const passwordHash = await bcrypt.hash('1234', BCRYPT_ROUNDS);
        await dbRun(
            `INSERT INTO users(username, password_hash, role, permissions) VALUES (?, ?, ?, ?)`,
            ['admin', passwordHash, 'admin', adminPermissions]
        );
    }

    const usersWithoutHash = await dbAll(`
        SELECT id, password
        FROM users
        WHERE password_hash IS NULL OR password_hash = ''
    `);

    for (const user of usersWithoutHash) {
        if (user.password) {
            const passwordHash = await bcrypt.hash(user.password, BCRYPT_ROUNDS);
            await dbRun(
                `UPDATE users SET password_hash = ?, password = NULL WHERE id = ?`,
                [passwordHash, user.id]
            );
        }
    }

    await dbRun(
        `UPDATE users SET role = ?, permissions = ? WHERE username = ?`,
        ['admin', adminPermissions, 'admin']
    );
}

async function requirePermission(req, res, permission) {
    const userId = req.header('x-user-id') || req.body.user_id;

    if (!userId) {
        res.status(401).json({ message: 'Usuario requerido' });
        return null;
    }

    const user = await dbGet(
        `SELECT id, username, role, permissions FROM users WHERE id = ?`,
        [userId]
    );

    if (!user) {
        res.status(401).json({ message: 'Usuario no valido' });
        return null;
    }

    const permissions = parsePermissions(user.permissions, user.role);

    if (!permissions.includes(permission)) {
        res.status(403).json({ message: 'No tienes permiso para esta accion' });
        return null;
    }

    return publicUser(user);
}

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Servidor funcionando correctamente' });
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Usuario y contraseña son obligatorios' });
    }

    try {
        const user = await dbGet(`SELECT * FROM users WHERE username = ?`, [username]);

        if (!user || !user.password_hash) {
            return res.status(401).json({ message: 'Usuario o contraseña incorrectos' });
        }

        const passwordIsValid = await bcrypt.compare(password, user.password_hash);

        if (!passwordIsValid) {
            return res.status(401).json({ message: 'Usuario o contraseña incorrectos' });
        }

        res.json({ success: true, user: publicUser(user) });
    } catch (err) {
        res.status(500).json({ message: 'Error al iniciar sesion' });
    }
});

app.get('/api/users', async (req, res) => {
    try {
        const requester = await requirePermission(req, res, 'users:read');

        if (!requester) {
            return;
        }

        const users = await dbAll(
            `SELECT id, username, role, permissions FROM users ORDER BY username`
        );
        res.json(users.map(publicUser));
    } catch (err) {
        res.status(500).json({ message: 'Error al consultar usuarios' });
    }
});

app.post('/api/users', async (req, res) => {
    try {
        const requester = await requirePermission(req, res, 'users:create');

        if (!requester) {
            return;
        }

        const { username, password, role = 'viewer', permissions } = req.body;

        if (!username || !password) {
            return res.status(400).json({ message: 'Usuario y contraseña son obligatorios' });
        }

        const normalizedRole = normalizeRole(role);
        const normalizedPermissions = normalizePermissions(normalizedRole, permissions);
        const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

        await dbRun(
            `INSERT INTO users(username, password_hash, role, permissions) VALUES (?, ?, ?, ?)`,
            [username, passwordHash, normalizedRole, JSON.stringify(normalizedPermissions)]
        );

        const createdUser = await dbGet(
            `SELECT id, username, role, permissions FROM users WHERE username = ?`,
            [username]
        );

        res.status(201).json({ success: true, user: publicUser(createdUser) });
    } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT') {
            return res.status(409).json({ message: 'Ese usuario ya existe' });
        }

        res.status(500).json({ message: 'Error al crear usuario' });
    }
});

app.put('/api/users/:id', async (req, res) => {
    try {
        const requester = await requirePermission(req, res, 'users:create');

        if (!requester) {
            return;
        }

        const { username, password = '', role = 'viewer', permissions } = req.body;

        if (!username) {
            return res.status(400).json({ message: 'Usuario obligatorio' });
        }

        const existingUser = await dbGet(
            `SELECT id FROM users WHERE id = ?`,
            [req.params.id]
        );

        if (!existingUser) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        const normalizedRole = normalizeRole(role);
        const normalizedPermissions = normalizePermissions(normalizedRole, permissions);
        const params = [
            username.trim(),
            normalizedRole,
            JSON.stringify(normalizedPermissions)
        ];
        let passwordSql = '';

        if (password) {
            passwordSql = ', password_hash = ?, password = NULL';
            params.push(await bcrypt.hash(password, BCRYPT_ROUNDS));
        }

        params.push(req.params.id);

        await dbRun(
            `UPDATE users
             SET username = ?, role = ?, permissions = ?${passwordSql}
             WHERE id = ?`,
            params
        );

        const updatedUser = await dbGet(
            `SELECT id, username, role, permissions FROM users WHERE id = ?`,
            [req.params.id]
        );

        res.json({ success: true, user: publicUser(updatedUser) });
    } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT') {
            return res.status(409).json({ message: 'Ese usuario ya existe' });
        }

        res.status(500).json({ message: 'Error al editar usuario' });
    }
});

async function listEquipment(req, res) {
    try {
        const requester = await requirePermission(req, res, 'motors:read');

        if (!requester) {
            return;
        }

        const includeInactive = req.query.includeInactive === '1';
        const activeFilter = includeInactive ? '' : 'WHERE active = 1';

        const rows = await dbAll(`
            SELECT
                id,
                equipment_key,
                name,
                area,
                nominal_current,
                critical,
                active
            FROM motors
            ${activeFilter}
            ORDER BY equipment_key
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: 'Error al consultar equipos' });
    }
}

app.get('/api/equipment', listEquipment);

app.post('/api/equipment', async (req, res) => {
    try {
        const requester = await requirePermission(req, res, 'motors:create');

        if (!requester) {
            return;
        }

        const {
            equipment_key,
            name,
            area = '',
            nominal_current = null,
            critical = 0
        } = req.body;

        const normalizedArea = normalizeArea(area.trim());

        if (!equipment_key || !name) {
            return res.status(400).json({ message: 'Clave y nombre del equipo son obligatorios' });
        }

        if (!ALLOWED_AREAS.includes(normalizedArea)) {
            return res.status(400).json({ message: 'Área no válida' });
        }

        const result = await dbRun(
            `INSERT INTO motors(equipment_key, name, area, nominal_current, critical, active) VALUES (?, ?, ?, ?, ?, 1)`,
            [
                equipment_key.trim().toUpperCase(),
                name.trim(),
                normalizedArea,
                nominal_current === null || nominal_current === '' ? null : Number(nominal_current),
                critical ? 1 : 0
            ]
        );

        const equipment = await dbGet(
            `SELECT id, equipment_key, name, area, nominal_current, critical, active FROM motors WHERE id = ?`,
            [result.lastID]
        );

        res.status(201).json({ success: true, equipment });
    } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT') {
            return res.status(409).json({ message: 'Ya existe un equipo con esa clave' });
        }

        res.status(500).json({ message: 'Error al crear equipo' });
    }
});

app.put('/api/equipment/:id', async (req, res) => {
    try {
        const requester = await requirePermission(req, res, 'motors:create');

        if (!requester) {
            return;
        }

        const {
            equipment_key,
            name,
            area = '',
            nominal_current = null,
            critical = 0,
            active = 1
        } = req.body;

        const normalizedArea = normalizeArea(area.trim());

        if (!equipment_key || !name) {
            return res.status(400).json({ message: 'Clave y nombre del equipo son obligatorios' });
        }

        if (!ALLOWED_AREAS.includes(normalizedArea)) {
            return res.status(400).json({ message: 'Área no válida' });
        }

        await dbRun(
            `UPDATE motors
             SET equipment_key = ?, name = ?, area = ?, nominal_current = ?, critical = ?, active = ?
             WHERE id = ?`,
            [
                equipment_key.trim().toUpperCase(),
                name.trim(),
                normalizedArea,
                nominal_current === null || nominal_current === '' ? null : Number(nominal_current),
                critical ? 1 : 0,
                active ? 1 : 0,
                req.params.id
            ]
        );

        const equipment = await dbGet(
            `SELECT id, equipment_key, name, area, nominal_current, critical, active FROM motors WHERE id = ?`,
            [req.params.id]
        );

        if (!equipment) {
            return res.status(404).json({ message: 'Equipo no encontrado' });
        }

        res.json({ success: true, equipment });
    } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT') {
            return res.status(409).json({ message: 'Ya existe un equipo con esa clave' });
        }

        res.status(500).json({ message: 'Error al editar equipo' });
    }
});

app.delete('/api/equipment/:id', async (req, res) => {
    try {
        const requester = await requirePermission(req, res, 'motors:create');

        if (!requester) {
            return;
        }

        const equipment = await dbGet(
            `SELECT id FROM motors WHERE id = ?`,
            [req.params.id]
        );

        if (!equipment) {
            return res.status(404).json({ message: 'Equipo no encontrado' });
        }

        await dbRun(
            `DELETE FROM inspection_details WHERE motor_id = ?`,
            [req.params.id]
        );
        await dbRun(
            `DELETE FROM inspections
             WHERE id NOT IN (SELECT inspection_id FROM inspection_details)`
        );
        await dbRun(
            `DELETE FROM motors WHERE id = ?`,
            [req.params.id]
        );

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: 'Error al eliminar equipo' });
    }
});

app.get('/api/motors', listEquipment);

app.get('/api/daily-readings', async (req, res) => {
    try {
        const requester = await requirePermission(req, res, 'reports:read');

        if (!requester) {
            return;
        }

        const filters = [];
        const params = [];

        if (req.query.critical === '1' || req.query.critical === '0') {
            filters.push('motors.critical = ?');
            params.push(Number(req.query.critical));
        }

        if (req.query.date) {
            filters.push('DATE(inspections.date) = ?');
            params.push(req.query.date);
        }

        if (req.query.area) {
            filters.push('motors.area = ?');
            params.push(req.query.area);
        }

        const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

        const rows = await dbAll(`
            SELECT
                inspection_details.id,
                inspections.date,
                users.username,
                motors.equipment_key,
                motors.name AS equipment_name,
                motors.area,
                motors.nominal_current,
                inspection_details.temperature,
                inspection_details.current,
                CASE
                    WHEN COALESCE(inspection_details.equipment_stopped, 0) = 0
                        AND motors.nominal_current IS NOT NULL
                        AND inspection_details.current > motors.nominal_current
                    THEN 1
                    ELSE 0
                END AS overloaded,
                COALESCE(inspection_details.equipment_stopped, 0) AS equipment_stopped,
                inspection_details.vibration,
                inspection_details.noise,
                COALESCE(inspection_details.cleaning_required, inspection_details.dirty, 0) AS cleaning_required,
                inspection_details.comments,
                current_user.username AS current_username,
                physical_user.username AS physical_username
            FROM inspection_details
            INNER JOIN inspections ON inspections.id = inspection_details.inspection_id
            INNER JOIN motors ON motors.id = inspection_details.motor_id
            LEFT JOIN users ON users.id = inspections.user_id
            LEFT JOIN users AS current_user ON current_user.id = inspection_details.current_user_id
            LEFT JOIN users AS physical_user ON physical_user.id = inspection_details.physical_user_id
            ${whereClause}
            ORDER BY inspections.date DESC, inspection_details.id DESC
            LIMIT 100
        `, params);

        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: 'Error al consultar registros diarios' });
    }
});

app.get('/api/follow-up-reports', async (req, res) => {
    try {
        const requester = await requirePermission(req, res, 'reports:read');

        if (!requester) {
            return;
        }

        const area = req.query.area;
        const params = [];
        let areaFilter = '';

        if (area) {
            areaFilter = 'AND motors.area = ?';
            params.push(area);
        }

        const rows = await dbAll(`
            SELECT
                inspection_details.id,
                inspections.date,
                users.username,
                motors.equipment_key,
                motors.name AS equipment_name,
                motors.area,
                motors.nominal_current,
                inspection_details.temperature,
                inspection_details.current,
                CASE
                    WHEN COALESCE(inspection_details.equipment_stopped, 0) = 0
                        AND motors.nominal_current IS NOT NULL
                        AND inspection_details.current > motors.nominal_current
                    THEN 1
                    ELSE 0
                END AS overloaded,
                COALESCE(inspection_details.equipment_stopped, 0) AS equipment_stopped,
                inspection_details.vibration,
                inspection_details.noise,
                COALESCE(inspection_details.cleaning_required, inspection_details.dirty, 0) AS cleaning_required,
                inspection_details.comments,
                inspection_details.action_taken,
                COALESCE(inspection_details.finding_closed, 0) AS finding_closed,
                inspection_details.closed_at,
                closer.username AS closed_by_username
            FROM inspection_details
            INNER JOIN inspections ON inspections.id = inspection_details.inspection_id
            INNER JOIN motors ON motors.id = inspection_details.motor_id
            LEFT JOIN users ON users.id = inspections.user_id
            LEFT JOIN users AS closer ON closer.id = inspection_details.closed_by
            WHERE (
                inspection_details.vibration = 1
                OR inspection_details.noise = 1
                OR (
                    COALESCE(inspection_details.equipment_stopped, 0) = 0
                    AND motors.nominal_current IS NOT NULL
                    AND inspection_details.current > motors.nominal_current
                )
                OR COALESCE(inspection_details.cleaning_required, inspection_details.dirty, 0) = 1
                OR TRIM(COALESCE(inspection_details.comments, '')) <> ''
            )
            AND COALESCE(inspection_details.finding_closed, 0) = 0
            ${areaFilter}
            ORDER BY inspections.date DESC, inspection_details.id DESC
            LIMIT 50
        `, params);

        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: 'Error al consultar reportes de seguimiento' });
    }
});

app.get('/api/dashboard-summary', async (req, res) => {
    try {
        const requester = await requirePermission(req, res, 'reports:read');

        if (!requester) {
            return;
        }

        const today = getLocalDateTime().slice(0, 10);
        const monthKey = today.slice(0, 7);
        const openFindingsCondition = `
            (
                inspection_details.vibration = 1
                OR inspection_details.noise = 1
                OR (
                    COALESCE(inspection_details.equipment_stopped, 0) = 0
                    AND motors.nominal_current IS NOT NULL
                    AND inspection_details.current > motors.nominal_current
                )
                OR COALESCE(inspection_details.cleaning_required, inspection_details.dirty, 0) = 1
                OR TRIM(COALESCE(inspection_details.comments, '')) <> ''
            )
            AND COALESCE(inspection_details.finding_closed, 0) = 0
        `;

        const [totalsRow, criticalCoverageRow, generalCoverageRow, areaRows, pendingCriticalRows, pendingGeneralRows] = await Promise.all([
            dbGet(`
                SELECT
                    COUNT(*) AS active_equipment,
                    SUM(CASE WHEN critical = 1 THEN 1 ELSE 0 END) AS critical_equipment,
                    SUM(CASE WHEN critical = 0 THEN 1 ELSE 0 END) AS general_equipment
                FROM motors
                WHERE active = 1
            `),
            dbGet(`
                SELECT COUNT(DISTINCT inspection_details.motor_id) AS reviewed_today
                FROM inspection_details
                INNER JOIN inspections ON inspections.id = inspection_details.inspection_id
                INNER JOIN motors ON motors.id = inspection_details.motor_id
                WHERE motors.active = 1
                  AND motors.critical = 1
                  AND DATE(inspections.date) = ?
            `, [today]),
            dbGet(`
                SELECT COUNT(DISTINCT inspection_details.motor_id) AS reviewed_month
                FROM inspection_details
                INNER JOIN inspections ON inspections.id = inspection_details.inspection_id
                INNER JOIN motors ON motors.id = inspection_details.motor_id
                WHERE motors.active = 1
                  AND motors.critical = 0
                  AND SUBSTR(inspections.date, 1, 7) = ?
            `, [monthKey]),
            dbAll(`
                SELECT
                    motors.area,
                    COUNT(*) AS total_equipment,
                    SUM(CASE WHEN motors.critical = 1 THEN 1 ELSE 0 END) AS critical_equipment,
                    SUM(CASE WHEN motors.critical = 0 THEN 1 ELSE 0 END) AS general_equipment,
                    SUM(CASE WHEN motors.critical = 1 AND EXISTS (
                        SELECT 1
                        FROM inspection_details
                        INNER JOIN inspections ON inspections.id = inspection_details.inspection_id
                        WHERE inspection_details.motor_id = motors.id
                          AND DATE(inspections.date) = ?
                    ) THEN 1 ELSE 0 END) AS critical_reviewed_today,
                    SUM(CASE WHEN motors.critical = 0 AND EXISTS (
                        SELECT 1
                        FROM inspection_details
                        INNER JOIN inspections ON inspections.id = inspection_details.inspection_id
                        WHERE inspection_details.motor_id = motors.id
                          AND SUBSTR(inspections.date, 1, 7) = ?
                    ) THEN 1 ELSE 0 END) AS general_reviewed_month,
                    SUM(CASE WHEN EXISTS (
                        SELECT 1
                        FROM inspection_details
                        INNER JOIN inspections ON inspections.id = inspection_details.inspection_id
                        WHERE inspection_details.motor_id = motors.id
                          AND ${openFindingsCondition}
                    ) THEN 1 ELSE 0 END) AS open_reports
                FROM motors
                WHERE motors.active = 1
                GROUP BY motors.area
                ORDER BY motors.area
            `, [today, monthKey]),
            dbAll(`
                SELECT motors.equipment_key, motors.name AS equipment_name, motors.area
                FROM motors
                WHERE motors.active = 1
                  AND motors.critical = 1
                  AND NOT EXISTS (
                    SELECT 1
                    FROM inspection_details
                    INNER JOIN inspections ON inspections.id = inspection_details.inspection_id
                    WHERE inspection_details.motor_id = motors.id
                      AND DATE(inspections.date) = ?
                  )
                ORDER BY motors.area, motors.equipment_key
                LIMIT 6
            `, [today]),
            dbAll(`
                SELECT motors.equipment_key, motors.name AS equipment_name, motors.area
                FROM motors
                WHERE motors.active = 1
                  AND motors.critical = 0
                  AND NOT EXISTS (
                    SELECT 1
                    FROM inspection_details
                    INNER JOIN inspections ON inspections.id = inspection_details.inspection_id
                    WHERE inspection_details.motor_id = motors.id
                      AND SUBSTR(inspections.date, 1, 7) = ?
                  )
                ORDER BY motors.area, motors.equipment_key
                LIMIT 6
            `, [monthKey])
        ]);

        const activeEquipment = Number(totalsRow?.active_equipment || 0);
        const criticalEquipment = Number(totalsRow?.critical_equipment || 0);
        const generalEquipment = Number(totalsRow?.general_equipment || 0);
        const criticalReviewedToday = Number(criticalCoverageRow?.reviewed_today || 0);
        const generalReviewedMonth = Number(generalCoverageRow?.reviewed_month || 0);

        res.json({
            today,
            month: monthKey,
            totals: {
                activeEquipment,
                criticalEquipment,
                generalEquipment
            },
            coverage: {
                criticalReviewedToday,
                criticalPendingToday: Math.max(criticalEquipment - criticalReviewedToday, 0),
                generalReviewedMonth,
                generalPendingMonth: Math.max(generalEquipment - generalReviewedMonth, 0)
            },
            areas: areaRows.map((row) => ({
                area: row.area || 'Sin área',
                totalEquipment: Number(row.total_equipment || 0),
                criticalEquipment: Number(row.critical_equipment || 0),
                generalEquipment: Number(row.general_equipment || 0),
                criticalReviewedToday: Number(row.critical_reviewed_today || 0),
                generalReviewedMonth: Number(row.general_reviewed_month || 0),
                openReports: Number(row.open_reports || 0)
            })),
            pending: {
                criticalToday: pendingCriticalRows,
                generalMonth: pendingGeneralRows
            }
        });
    } catch (err) {
        res.status(500).json({ message: 'Error al consultar el resumen del dashboard' });
    }
});

app.get('/api/reports', async (req, res) => {
    try {
        const requester = await requirePermission(req, res, 'reports:read');

        if (!requester) {
            return;
        }

        const overloadedCondition = `
            COALESCE(inspection_details.equipment_stopped, 0) = 0
            AND motors.nominal_current IS NOT NULL
            AND inspection_details.current > motors.nominal_current
        `;
        const findingsCondition = `
            (
                inspection_details.vibration = 1
                OR inspection_details.noise = 1
                OR COALESCE(inspection_details.cleaning_required, inspection_details.dirty, 0) = 1
                OR TRIM(COALESCE(inspection_details.comments, '')) <> ''
                OR (${overloadedCondition})
            )
        `;
        const filters = [];
        const params = [];

        if (req.query.area) {
            filters.push('motors.area = ?');
            params.push(req.query.area);
        }

        if (req.query.date) {
            filters.push('DATE(inspections.date) = ?');
            params.push(req.query.date);
        }

        switch (req.query.finding) {
            case 'vibration':
                filters.push('inspection_details.vibration = 1');
                break;
            case 'noise':
                filters.push('inspection_details.noise = 1');
                break;
            case 'cleaning':
                filters.push('COALESCE(inspection_details.cleaning_required, inspection_details.dirty, 0) = 1');
                break;
            case 'comments':
                filters.push("TRIM(COALESCE(inspection_details.comments, '')) <> ''");
                break;
            case 'overloaded':
                filters.push(`(${overloadedCondition})`);
                break;
            default:
                break;
        }

        const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
        const rows = await dbAll(`
            SELECT
                inspection_details.id,
                inspections.date,
                users.username,
                motors.equipment_key,
                motors.name AS equipment_name,
                motors.area,
                motors.critical,
                motors.nominal_current,
                inspection_details.temperature,
                inspection_details.current,
                CASE
                    WHEN ${overloadedCondition}
                    THEN 1
                    ELSE 0
                END AS overloaded,
                COALESCE(inspection_details.equipment_stopped, 0) AS equipment_stopped,
                inspection_details.vibration,
                inspection_details.noise,
                COALESCE(inspection_details.cleaning_required, inspection_details.dirty, 0) AS cleaning_required,
                inspection_details.comments,
                inspection_details.action_taken,
                COALESCE(inspection_details.finding_closed, 0) AS finding_closed,
                inspection_details.closed_at,
                closer.username AS closed_by_username
            FROM inspection_details
            INNER JOIN inspections ON inspections.id = inspection_details.inspection_id
            INNER JOIN motors ON motors.id = inspection_details.motor_id
            LEFT JOIN users ON users.id = inspections.user_id
            LEFT JOIN users AS closer ON closer.id = inspection_details.closed_by
            ${whereClause}
            ORDER BY inspections.date DESC, inspection_details.id DESC
        `, params);

        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: 'Error al consultar reportes' });
    }
});

app.patch('/api/reports/:id/close', async (req, res) => {
    try {
        const requester = await requirePermission(req, res, 'inspections:create');

        if (!requester) {
            return;
        }

        const actionTaken = String(req.body.action_taken || '').trim();

        if (!actionTaken) {
            return res.status(400).json({ message: 'Describe la acción realizada' });
        }

        const report = await dbGet(
            `SELECT id FROM inspection_details WHERE id = ?`,
            [req.params.id]
        );

        if (!report) {
            return res.status(404).json({ message: 'Reporte no encontrado' });
        }

        await dbRun(
            `UPDATE inspection_details
             SET action_taken = ?,
                 finding_closed = 1,
                 closed_at = ?,
                 closed_by = ?
             WHERE id = ?`,
            [actionTaken, getLocalDateTime(), requester.id, req.params.id]
        );

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: 'Error al cerrar hallazgo' });
    }
});

async function createDailyReading(req, res) {
    const {
        equipment_key,
        motor_id,
        temperature,
        current,
        equipment_stopped,
        reading_section = 'full',
        cleaning_required,
        dirty,
        noise,
        vibration,
        comments
    } = req.body;

    try {
        const requester = await requirePermission(req, res, 'inspections:create');

        if (!requester) {
            return;
        }

        let equipmentId = motor_id;

        if (!equipmentId && equipment_key) {
            const equipment = await dbGet(
                `SELECT id FROM motors WHERE equipment_key = ? AND active = 1`,
                [equipment_key.trim().toUpperCase()]
            );
            equipmentId = equipment?.id;
        }

        if (!equipmentId) {
            return res.status(400).json({ message: 'Equipo requerido' });
        }

        const stopped = equipment_stopped ? 1 : 0;
        const section = ['current', 'physical', 'full'].includes(reading_section) ? reading_section : 'full';
        const isCurrentSection = section === 'current';
        const isPhysicalSection = section === 'physical';
        const localDateTime = getLocalDateTime();
        const localDate = localDateTime.slice(0, 10);

        if (isCurrentSection && (current === undefined || current === null || current === '')) {
            return res.status(400).json({ message: 'Corriente obligatoria' });
        }

        if (isPhysicalSection && !stopped && (temperature === undefined || temperature === null || temperature === '')) {
            return res.status(400).json({ message: 'Temperatura obligatoria' });
        }

        if (!isCurrentSection && !isPhysicalSection && !stopped && (temperature === undefined || temperature === null || current === undefined || current === null)) {
            return res.status(400).json({ message: 'Temperatura y corriente son obligatorias' });
        }

        const existingDetail = await dbGet(
            `SELECT inspection_details.id
             FROM inspection_details
             INNER JOIN inspections ON inspections.id = inspection_details.inspection_id
             WHERE inspection_details.motor_id = ?
                AND DATE(inspections.date) = ?
             ORDER BY inspection_details.id DESC
             LIMIT 1`,
            [equipmentId, localDate]
        );
        const needsCleaning = cleaning_required !== undefined ? cleaning_required : dirty;

        if (existingDetail) {
            if (isCurrentSection) {
                await dbRun(
                    `UPDATE inspection_details
                     SET current = ?,
                         current_user_id = ?,
                         current_recorded_at = ?
                     WHERE id = ?`,
                    [current, requester.id, localDateTime, existingDetail.id]
                );
            } else if (isPhysicalSection) {
                await dbRun(
                    `UPDATE inspection_details
                     SET temperature = ?,
                         equipment_stopped = ?,
                         dirty = ?,
                         cleaning_required = ?,
                         noise = ?,
                         vibration = ?,
                         comments = ?,
                         physical_user_id = ?,
                         physical_recorded_at = ?
                     WHERE id = ?`,
                    [
                        stopped ? null : temperature,
                        stopped,
                        needsCleaning ? 1 : 0,
                        needsCleaning ? 1 : 0,
                        noise ? 1 : 0,
                        vibration ? 1 : 0,
                        comments,
                        requester.id,
                        localDateTime,
                        existingDetail.id
                    ]
                );
            } else {
                await dbRun(
                    `UPDATE inspection_details
                     SET temperature = ?,
                         current = ?,
                         equipment_stopped = ?,
                         dirty = ?,
                         cleaning_required = ?,
                         noise = ?,
                         vibration = ?,
                         comments = ?,
                         current_user_id = ?,
                         current_recorded_at = ?,
                         physical_user_id = ?,
                         physical_recorded_at = ?
                     WHERE id = ?`,
                    [
                        stopped ? null : temperature,
                        stopped ? null : current,
                        stopped,
                        needsCleaning ? 1 : 0,
                        needsCleaning ? 1 : 0,
                        noise ? 1 : 0,
                        vibration ? 1 : 0,
                        comments,
                        requester.id,
                        localDateTime,
                        requester.id,
                        localDateTime,
                        existingDetail.id
                    ]
                );
            }

            return res.json({ success: true, updated: true });
        }

        const inspection = await dbRun(
            `INSERT INTO inspections(user_id, date) VALUES(?, ?)`,
            [requester.id, localDateTime]
        );

        await dbRun(
            `INSERT INTO inspection_details(
                inspection_id,
                motor_id,
                temperature,
                current,
                equipment_stopped,
                dirty,
                cleaning_required,
                noise,
                vibration,
                comments,
                current_user_id,
                current_recorded_at,
                physical_user_id,
                physical_recorded_at
            ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [
                inspection.lastID,
                equipmentId,
                isCurrentSection ? null : (stopped ? null : temperature),
                isPhysicalSection ? null : (stopped ? null : current),
                stopped,
                isCurrentSection ? 0 : (needsCleaning ? 1 : 0),
                isCurrentSection ? 0 : (needsCleaning ? 1 : 0),
                isCurrentSection ? 0 : (noise ? 1 : 0),
                isCurrentSection ? 0 : (vibration ? 1 : 0),
                isCurrentSection ? '' : comments,
                isPhysicalSection ? null : requester.id,
                isPhysicalSection ? null : localDateTime,
                isCurrentSection ? null : requester.id,
                isCurrentSection ? null : localDateTime
            ]
        );

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: 'Error al guardar registro diario' });
    }
}

app.post('/api/daily-readings', createDailyReading);
app.post('/api/inspection', createDailyReading);

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

initializeDatabase()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Servidor corriendo en http://localhost:${PORT}/`);
        });
    })
    .catch((err) => {
        console.error('Error inicializando la base de datos:', err);
        process.exit(1);
    });
