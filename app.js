const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

const app = express();
const db = new sqlite3.Database(path.join(__dirname, 'database.db'));
const PORT = process.env.PORT || 3000;
const BCRYPT_ROUNDS = 12;

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

    await dbRun(`
        UPDATE inspection_details
        SET cleaning_required = dirty
        WHERE cleaning_required IS NULL
    `);

    await dbRun(`
        INSERT OR IGNORE INTO motors(equipment_key, name, area, critical, active)
        VALUES
            ('MP2-010', 'M.B. Vacio no. 1', 'Maquina 2', 1, 1),
            ('MP2-011', 'M.B. Vacio no. 2', 'Maquina 2', 1, 1),
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
            critical = 0
        } = req.body;

        if (!equipment_key || !name) {
            return res.status(400).json({ message: 'Clave y nombre del equipo son obligatorios' });
        }

        const result = await dbRun(
            `INSERT INTO motors(equipment_key, name, area, critical, active) VALUES (?, ?, ?, ?, 1)`,
            [equipment_key.trim().toUpperCase(), name.trim(), area.trim(), critical ? 1 : 0]
        );

        const equipment = await dbGet(
            `SELECT id, equipment_key, name, area, critical, active FROM motors WHERE id = ?`,
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
            critical = 0,
            active = 1
        } = req.body;

        if (!equipment_key || !name) {
            return res.status(400).json({ message: 'Clave y nombre del equipo son obligatorios' });
        }

        await dbRun(
            `UPDATE motors
             SET equipment_key = ?, name = ?, area = ?, critical = ?, active = ?
             WHERE id = ?`,
            [
                equipment_key.trim().toUpperCase(),
                name.trim(),
                area.trim(),
                critical ? 1 : 0,
                active ? 1 : 0,
                req.params.id
            ]
        );

        const equipment = await dbGet(
            `SELECT id, equipment_key, name, area, critical, active FROM motors WHERE id = ?`,
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

app.get('/api/motors', listEquipment);

app.get('/api/daily-readings', async (req, res) => {
    try {
        const requester = await requirePermission(req, res, 'reports:read');

        if (!requester) {
            return;
        }

        const rows = await dbAll(`
            SELECT
                inspection_details.id,
                inspections.date,
                users.username,
                motors.equipment_key,
                motors.name AS equipment_name,
                motors.area,
                inspection_details.temperature,
                inspection_details.current,
                inspection_details.vibration,
                inspection_details.noise,
                COALESCE(inspection_details.cleaning_required, inspection_details.dirty, 0) AS cleaning_required,
                inspection_details.comments
            FROM inspection_details
            INNER JOIN inspections ON inspections.id = inspection_details.inspection_id
            INNER JOIN motors ON motors.id = inspection_details.motor_id
            LEFT JOIN users ON users.id = inspections.user_id
            ORDER BY inspections.date DESC, inspection_details.id DESC
            LIMIT 100
        `);

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
                inspection_details.temperature,
                inspection_details.current,
                inspection_details.vibration,
                inspection_details.noise,
                COALESCE(inspection_details.cleaning_required, inspection_details.dirty, 0) AS cleaning_required,
                inspection_details.comments
            FROM inspection_details
            INNER JOIN inspections ON inspections.id = inspection_details.inspection_id
            INNER JOIN motors ON motors.id = inspection_details.motor_id
            LEFT JOIN users ON users.id = inspections.user_id
            WHERE (
                inspection_details.vibration = 1
                OR inspection_details.noise = 1
                OR COALESCE(inspection_details.cleaning_required, inspection_details.dirty, 0) = 1
                OR TRIM(COALESCE(inspection_details.comments, '')) <> ''
            )
            ${areaFilter}
            ORDER BY inspections.date DESC, inspection_details.id DESC
            LIMIT 50
        `, params);

        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: 'Error al consultar reportes de seguimiento' });
    }
});

async function createDailyReading(req, res) {
    const {
        equipment_key,
        motor_id,
        temperature,
        current,
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

        if (temperature === undefined || current === undefined) {
            return res.status(400).json({ message: 'Temperatura y corriente son obligatorias' });
        }

        const inspection = await dbRun(`INSERT INTO inspections(user_id) VALUES(?)`, [requester.id]);
        const needsCleaning = cleaning_required !== undefined ? cleaning_required : dirty;

        await dbRun(
            `INSERT INTO inspection_details(
                inspection_id,
                motor_id,
                temperature,
                current,
                dirty,
                cleaning_required,
                noise,
                vibration,
                comments
            ) VALUES(?,?,?,?,?,?,?,?,?)`,
            [
                inspection.lastID,
                equipmentId,
                temperature,
                current,
                needsCleaning ? 1 : 0,
                needsCleaning ? 1 : 0,
                noise ? 1 : 0,
                vibration ? 1 : 0,
                comments
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
