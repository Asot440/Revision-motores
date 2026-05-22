const API = {
    getUserId() {
        const user = getCurrentUser();
        return user?.id;
    },

    getHeaders(includeJson = false) {
        const headers = {};
        const userId = this.getUserId();

        if (includeJson) {
            headers['Content-Type'] = 'application/json';
        }

        if (userId) {
            headers['x-user-id'] = userId;
        }

        return headers;
    },

    async request(url, options = {}) {
        const response = await fetch(url, options);
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || 'Error en la petición');
        }

        return result;
    },

    get(url) {
        return this.request(url, { headers: this.getHeaders() });
    },

    post(url, data) {
        return this.request(url, {
            method: 'POST',
            headers: this.getHeaders(true),
            body: JSON.stringify(data)
        });
    },

    put(url, data) {
        return this.request(url, {
            method: 'PUT',
            headers: this.getHeaders(true),
            body: JSON.stringify(data)
        });
    },

    patch(url, data) {
        return this.request(url, {
            method: 'PATCH',
            headers: this.getHeaders(true),
            body: JSON.stringify(data)
        });
    },

    delete(url) {
        return this.request(url, {
            method: 'DELETE',
            headers: this.getHeaders()
        });
    }
};

function getCurrentUser() {
    return JSON.parse(localStorage.getItem('user') || 'null');
}

let printTemplate = {
    companyName: 'EMPAQUES MODERNOS SAN PABLO S. DE R.L. DE C.V.',
    criticalTitle: 'REVISIÓN DE EQUIPO ELÉCTRICO CRÍTICO',
    generalTitle: 'REVISIÓN DE EQUIPO ELÉCTRICO GENERAL',
    logoSrc: 'img/print-logo.jpg',
    footer: {
        code: 'F-01-MIF-S-42',
        version: 'Versión: 0',
        edition: 'Edición: 1',
        page: 'Página 1'
    }
};

const ROLE_PERMISSIONS = {
    admin: ['users:create', 'users:read', 'motors:create', 'motors:read', 'inspections:create', 'reports:read'],
    supervisor: ['users:read', 'motors:create', 'motors:read', 'inspections:create', 'reports:read'],
    technician: ['motors:read', 'inspections:create'],
    viewer: ['motors:read', 'reports:read']
};

const PERMISSION_LABELS = {
    'users:create': 'Crear y editar usuarios',
    'users:read': 'Consultar usuarios',
    'motors:create': 'Crear y editar equipos',
    'motors:read': 'Consultar equipos',
    'inspections:create': 'Registrar revisiones',
    'reports:read': 'Consultar reportes'
};

function showAlert(message, type = 'info') {
    document.querySelector('.app-alert')?.remove();

    const alert = document.createElement('div');
    alert.className = `app-alert app-alert-${type}`;
    alert.textContent = message;
    document.body.appendChild(alert);

    setTimeout(() => alert.remove(), 3000);
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function initLogin() {
    const loginForm = document.getElementById('loginForm');

    if (!loginForm) {
        return;
    }

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        try {
            const data = await API.post('/api/login', {
                username: document.getElementById('username').value.trim(),
                password: document.getElementById('password').value
            });

            localStorage.setItem('user', JSON.stringify(data.user));
            showAlert('Bienvenido', 'success');

            setTimeout(() => {
                window.location.href = '/dashboard.html';
            }, 700);
        } catch (error) {
            showAlert(error.message || 'Usuario o contraseña incorrectos', 'error');
        }
    });
}

function initDashboard() {
    if (!document.querySelector('.dashboard-page')) {
        return;
    }

    const user = getCurrentUser();

    if (!user) {
        window.location.href = '/';
        return;
    }

    const userName = document.querySelector('.user-name');
    const userAvatar = document.querySelector('.user-avatar');

    if (userName) {
        userName.textContent = `${user.username} (${user.role})`;
    }

    if (userAvatar) {
        userAvatar.textContent = user.username.slice(0, 2).toUpperCase();
    }

    document.getElementById('userMenuBtn')?.addEventListener('click', () => {
        document.getElementById('userDropdown')?.classList.toggle('active');
    });

    document.getElementById('logoutBtn')?.addEventListener('click', (event) => {
        event.preventDefault();
        localStorage.removeItem('user');
        window.location.href = '/';
    });

    document.querySelectorAll('.nav-item[data-page], .card-clickable[data-action]').forEach((item) => {
        item.addEventListener('click', () => showPage(item.dataset.page || item.dataset.action));
    });

    document.getElementById('reportAreaSelect')?.addEventListener('change', loadFollowUpReports);
    ['reportsAreaFilter', 'reportsDateFilter', 'reportsFindingFilter'].forEach((filterId) => {
        document.getElementById(filterId)?.addEventListener('change', loadReports);
    });
    document.getElementById('reportsClearFilters')?.addEventListener('click', () => {
        document.getElementById('reportsAreaFilter').value = '';
        document.getElementById('reportsDateFilter').value = '';
        document.getElementById('reportsFindingFilter').value = '';
        loadReports();
    });
    document.getElementById('criticalQueryBtn')?.addEventListener('click', () => loadReviewQuery(true));
    document.getElementById('generalQueryBtn')?.addEventListener('click', () => loadReviewQuery(false));
    document.getElementById('criticalQueryDate')?.addEventListener('change', () => loadReviewQuery(true));
    document.getElementById('generalQueryDate')?.addEventListener('change', () => loadReviewQuery(false));
    document.getElementById('criticalQueryArea')?.addEventListener('change', () => loadReviewQuery(true));
    document.getElementById('generalQueryArea')?.addEventListener('change', () => loadReviewQuery(false));
    document.getElementById('criticalPrintBtn')?.addEventListener('click', () => printReviewQuery(true));
    document.getElementById('generalPrintBtn')?.addEventListener('click', () => printReviewQuery(false));

    initEquipmentDatabase(user);
    initUserManagement(user);
    loadHomeDashboard();
    loadFollowUpReports();
    loadReports();
    initReviewQueryDates();
    loadPrintTemplate();
}

function showPage(page) {
    document.querySelectorAll('.page').forEach((section) => {
        section.classList.remove('active');
    });

    document.getElementById(`${page}-page`)?.classList.add('active');

    document.querySelectorAll('.nav-item').forEach((navItem) => {
        navItem.classList.toggle('active', navItem.dataset.page === page);
    });

    if (page === 'reports') {
        loadReports();
    }

    if (page === 'users') {
        loadUsers();
    }

    if (page === 'critical-query') {
        loadReviewQuery(true);
    }

    if (page === 'general-query') {
        loadReviewQuery(false);
    }

    if (page === 'home') {
        loadHomeDashboard();
        loadFollowUpReports();
    }
}

async function loadEquipment() {
    return API.get('/api/equipment?includeInactive=1');
}

let equipmentCache = [];

function renderEquipmentOptions(selectId, equipment, critical, area = '') {
    const select = document.getElementById(selectId);

    if (!select) {
        return;
    }

    const available = equipment.filter((item) => (
        item.active
        && Boolean(item.critical) === critical
        && (!area || item.area === area)
    ));

    select.innerHTML = available.length
        ? available.map((item) => `
            <option value="${item.id}">${escapeHtml(item.equipment_key)} - ${escapeHtml(item.name)}</option>
        `).join('')
        : '<option value="">Sin equipos para esta área</option>';
}

function refreshReviewEquipmentOptions() {
    renderEquipmentOptions(
        'readingEquipment',
        equipmentCache,
        false,
        document.getElementById('readingArea')?.value || ''
    );
    renderEquipmentOptions(
        'criticalReadingEquipment',
        equipmentCache,
        true,
        document.getElementById('criticalReadingArea')?.value || ''
    );
    renderEquipmentOptions(
        'currentReadingEquipment',
        equipmentCache,
        false,
        document.getElementById('currentReadingArea')?.value || ''
    );
    renderEquipmentOptions(
        'criticalCurrentEquipment',
        equipmentCache,
        true,
        document.getElementById('criticalCurrentArea')?.value || ''
    );
}

function renderEquipment(equipment) {
    equipmentCache = equipment;
    const tableBody = document.getElementById('equipmentTableBody');
    const areaFilter = document.getElementById('equipmentAreaFilter');
    const typeFilter = document.getElementById('equipmentTypeFilter');
    const selectedArea = areaFilter?.value || '';
    const selectedType = typeFilter?.value || '';
    const visibleEquipment = equipment.filter((item) => (
        (!selectedArea || item.area === selectedArea)
        && (
            !selectedType
            || (selectedType === 'critical' && item.critical)
            || (selectedType === 'general' && !item.critical)
        )
    ));

    if (tableBody) {
        tableBody.innerHTML = visibleEquipment.length
            ? visibleEquipment.map((item) => `
                <tr>
                    <td>${escapeHtml(item.equipment_key)}</td>
                    <td>${escapeHtml(item.name)}</td>
                    <td>${escapeHtml(item.area || '-')}</td>
                    <td>${item.nominal_current ?? '-'} A</td>
                    <td>${item.critical ? 'Crítico' : 'General'}</td>
                    <td>${item.active ? 'Activo' : 'Inactivo'}</td>
                    <td>
                        <button class="btn-table-action" type="button" data-edit-equipment="${item.id}">
                            Editar
                        </button>
                        <button class="btn-table-action btn-table-danger" type="button" data-delete-equipment="${item.id}">
                            Eliminar
                        </button>
                    </td>
                </tr>
            `).join('')
            : '<tr><td class="empty-row" colspan="7">Sin equipos registrados</td></tr>';
    }

    refreshReviewEquipmentOptions();

    if (areaFilter) {
        const areas = [...new Set(equipment.map((item) => item.area).filter(Boolean))].sort();
        areaFilter.innerHTML = `
            <option value="">Todas las áreas</option>
            ${areas.map((area) => `
                <option value="${escapeHtml(area)}"${area === selectedArea ? ' selected' : ''}>${escapeHtml(area)}</option>
            `).join('')}
        `;
    }

    document.querySelectorAll('[data-edit-equipment]').forEach((button) => {
        button.addEventListener('click', () => {
            const equipmentId = Number(button.dataset.editEquipment);
            const item = equipment.find((candidate) => candidate.id === equipmentId);

            if (item) {
                setEquipmentFormMode(item);
            }
        });
    });

    document.querySelectorAll('[data-delete-equipment]').forEach((button) => {
        button.addEventListener('click', async () => {
            const equipmentId = Number(button.dataset.deleteEquipment);
            const item = equipment.find((candidate) => candidate.id === equipmentId);

            if (!item) {
                return;
            }

            const confirmed = window.confirm(`¿Eliminar el equipo ${item.equipment_key} - ${item.name}?`);

            if (!confirmed) {
                return;
            }

            try {
                await API.delete(`/api/equipment/${equipmentId}`);
                await refreshEquipmentDatabase();
                showAlert('Equipo eliminado', 'success');
            } catch (error) {
                showAlert(error.message || 'Error al eliminar equipo', 'error');
            }
        });
    });
}

function renderReadingsTable(tableBody, readings, emptyMessage) {
    tableBody.innerHTML = readings.length
        ? readings.map((item) => {
            const findings = [
                item.current === null || item.current === undefined ? 'Pendiente subestación' : '',
                !item.equipment_stopped && (item.temperature === null || item.temperature === undefined) ? 'Pendiente revisión física' : '',
                item.equipment_stopped ? 'Equipo parado' : '',
                item.overloaded ? 'Sobrecargado' : '',
                item.vibration ? 'Vibración' : '',
                item.noise ? 'Ruido' : '',
                item.cleaning_required ? 'Limpieza' : ''
            ].filter(Boolean).join(', ') || '-';
            const temperature = item.equipment_stopped
                ? '-'
                : item.temperature === null || item.temperature === undefined
                    ? 'Pendiente'
                    : `${escapeHtml(item.temperature)} °C`;
            const current = item.current === null || item.current === undefined
                ? 'Pendiente'
                : `${escapeHtml(item.current)} A`;

            return `
                <tr>
                    <td>${escapeHtml(formatRecordDate(item.date))}</td>
                    <td>${escapeHtml(item.equipment_key)}</td>
                    <td>${escapeHtml(item.equipment_name)}</td>
                    <td>${temperature}</td>
                    <td>${current}</td>
                    <td>${escapeHtml(findings)}</td>
                    <td>${escapeHtml(item.comments || '-')}</td>
                </tr>
            `;
        }).join('')
        : `<tr><td class="empty-row" colspan="7">${emptyMessage}</td></tr>`;
}

async function loadReadings(critical) {
    const tableBody = document.getElementById(
        critical ? 'criticalReadingsTableBody' : 'dailyReadingsTableBody'
    );

    if (!tableBody) {
        return;
    }

    try {
        const readings = await API.get(`/api/daily-readings?critical=${critical ? '1' : '0'}`);
        renderReadingsTable(
            tableBody,
            readings,
            critical ? 'Sin registros críticos' : 'Sin registros generales'
        );
    } catch (error) {
        tableBody.innerHTML = '<tr><td class="empty-row" colspan="7">No tienes permiso para ver registros</td></tr>';
    }
}

async function loadDailyReadings() {
    await Promise.all([
        loadReadings(false),
        loadReadings(true)
    ]);
}

function renderReviewQueryTable(tableBody, readings, emptyMessage) {
    tableBody.innerHTML = readings.length
        ? readings.map((item) => {
            const findings = [
                item.current === null || item.current === undefined ? 'Pendiente subestación' : '',
                !item.equipment_stopped && (item.temperature === null || item.temperature === undefined) ? 'Pendiente revisión física' : '',
                item.equipment_stopped ? 'Equipo parado' : '',
                item.overloaded ? 'Sobrecargado' : '',
                item.vibration ? 'Vibración' : '',
                item.noise ? 'Ruido' : '',
                item.cleaning_required ? 'Limpieza' : ''
            ].filter(Boolean).join(', ') || '-';
            const temperature = item.equipment_stopped
                ? '-'
                : item.temperature === null || item.temperature === undefined
                    ? 'Pendiente'
                    : `${escapeHtml(item.temperature)} \u00b0C`;
            const current = item.current === null || item.current === undefined
                ? 'Pendiente'
                : `${escapeHtml(item.current)} A`;

            return `
                <tr>
                    <td>${escapeHtml(formatRecordDate(item.date))}</td>
                    <td>${escapeHtml(item.area || '-')}</td>
                    <td>${escapeHtml(item.equipment_key)}</td>
                    <td>${escapeHtml(item.equipment_name)}</td>
                    <td>${temperature}</td>
                    <td>${current}</td>
                    <td>${escapeHtml(findings)}</td>
                    <td>${escapeHtml(item.comments || '-')}</td>
                    <td>${escapeHtml(item.username || '-')}</td>
                </tr>
            `;
        }).join('')
        : `<tr><td class="empty-row" colspan="9">${emptyMessage}</td></tr>`;
}

async function loadReviewQuery(critical) {
    const dateInput = document.getElementById(critical ? 'criticalQueryDate' : 'generalQueryDate');
    const areaInput = document.getElementById(critical ? 'criticalQueryArea' : 'generalQueryArea');
    const tableBody = document.getElementById(critical ? 'criticalQueryTableBody' : 'generalQueryTableBody');

    if (!dateInput || !areaInput || !tableBody) {
        return;
    }

    if (!dateInput.value) {
        dateInput.value = formatInputDate();
    }
    renderPrintTemplate();

    try {
        const params = new URLSearchParams({
            critical: critical ? '1' : '0',
            date: dateInput.value
        });

        if (areaInput.value) {
            params.set('area', areaInput.value);
        }

        const readings = await API.get(
            `/api/daily-readings?${params.toString()}`
        );
        renderReviewQueryTable(
            tableBody,
            readings,
            critical ? 'Sin revisión crítica para este día' : 'Sin revisión general para este día'
        );
    } catch (error) {
        tableBody.innerHTML = '<tr><td class="empty-row" colspan="9">No se pudo cargar la revisión</td></tr>';
    }
}

async function printReviewQuery(critical) {
    await loadReviewQuery(critical);
    renderPrintTemplate();
    document.body.classList.toggle('print-critical-query', critical);
    document.body.classList.toggle('print-general-query', !critical);
    window.print();
    setTimeout(() => {
        document.body.classList.remove('print-critical-query', 'print-general-query');
    }, 500);
}

function formatRelativeDate(dateValue) {
    const date = new Date(dateValue);
    const diffDays = Math.floor((Date.now() - date.getTime()) / 86400000);

    if (Number.isNaN(date.getTime())) {
        return '';
    }

    if (diffDays <= 0) {
        return 'Hoy';
    }

    if (diffDays === 1) {
        return 'Ayer';
    }

    return `Hace ${diffDays} días`;
}

function formatRecordDate(dateValue) {
    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return '';
    }

    return date.toLocaleDateString();
}

function hasReportFinding(item) {
    return Boolean(
        item.vibration
        || item.noise
        || item.overloaded
        || item.cleaning_required
        || String(item.comments || '').trim()
    );
}

function formatDashboardTimestamp(date = new Date()) {
    return date.toLocaleString('es-MX', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function setHomeStatValue(id, value, detail = '') {
    const valueElement = document.getElementById(id);
    const detailElement = document.getElementById(`${id}Detail`);

    if (valueElement) {
        valueElement.textContent = value;
    }

    if (detailElement) {
        detailElement.textContent = detail;
    }
}

function setHomeStatCard(id, label, helper = '') {
    const valueElement = document.getElementById(id);
    const card = valueElement?.closest('.stat-card');
    const labelElement = card?.querySelector('.stat-label');
    const helperElement = document.getElementById(`${id}Detail`) || card?.querySelector('.stat-helper');

    if (labelElement) {
        labelElement.textContent = label;
    }

    if (helperElement && helper) {
        helperElement.textContent = helper;
    }
}

function setupHomeDashboardLayout() {
    const homeLayout = document.querySelector('#home-page .home-layout');

    if (!homeLayout || homeLayout.dataset.dashboardEnhanced === '1') {
        return;
    }

    homeLayout.innerHTML = `
        <section class="home-main">
            <div class="home-insights-grid">
                <article class="reports-panel">
                    <div class="reports-header">
                        <div>
                            <h2>Cobertura de inspección</h2>
                            <p>Avance del día por criticidad y total de equipos revisados.</p>
                        </div>
                    </div>
                    <div class="home-coverage-chart" id="homeCoverageChart"></div>
                </article>

                <article class="reports-panel">
                    <div class="reports-header">
                        <div>
                            <h2>Carga por área</h2>
                            <p>Comparativo simple de equipos y reportes abiertos por área.</p>
                        </div>
                    </div>
                    <div class="home-bar-chart" id="homeAreaChart"></div>
                </article>
            </div>

            <article class="reports-panel">
                <div class="reports-header">
                    <div>
                        <h2>Control de periodicidad</h2>
                        <p>Seguimiento operativo según la frecuencia real de inspección.</p>
                    </div>
                </div>
                <div class="home-cycle-grid" id="homeCycleSummary"></div>
            </article>

            <div class="home-insights-grid">
                <article class="reports-panel">
                    <div class="reports-header">
                        <div>
                            <h2>Hallazgos frecuentes</h2>
                            <p>Comportamiento acumulado de las inspecciones registradas.</p>
                        </div>
                    </div>
                    <div class="home-finding-list" id="homeFindingSummary"></div>
                </article>

                <article class="reports-panel">
                    <div class="reports-header">
                        <div>
                            <h2>Resumen por área</h2>
                            <p>Equipos, críticos, revisión de hoy y reportes abiertos.</p>
                        </div>
                    </div>
                    <div class="home-summary-list" id="homeAreaSummary"></div>
                </article>
            </div>
        </section>

        <section class="home-reports">
            <div class="reports-panel">
                <div class="reports-header">
                    <div>
                        <h2>Cola de atención</h2>
                        <p>Hallazgos abiertos que requieren mantenimiento o seguimiento.</p>
                    </div>
                    <div class="home-action-badges">
                        <span class="report-flag report-flag-overload">Sobrecarga</span>
                        <span class="report-flag report-flag-vibration">Vibración</span>
                        <span class="report-flag report-flag-comment">Seguimiento</span>
                    </div>
                </div>

                <div class="report-list" id="homePriorityList"></div>
            </div>
        </section>
    `;

    homeLayout.dataset.dashboardEnhanced = '1';
}

function renderHomeAreaSummary(areaSummary) {
    const container = document.getElementById('homeAreaSummary');

    if (!container) {
        return;
    }

    if (!areaSummary.length) {
        container.innerHTML = '<div class="home-empty-state">No hay áreas con información disponible.</div>';
        return;
    }

    container.innerHTML = areaSummary.map((item) => `
        <article class="home-summary-card">
            <div>
                <strong>${escapeHtml(item.area)}</strong>
                <span>${item.openReports} reportes abiertos</span>
            </div>
            <div class="home-summary-metrics">
                <span>Equipos: ${item.totalEquipment}</span>
                <span>Críticos: ${item.criticalEquipment}</span>
                <span>Críticos hoy: ${item.criticalReviewedToday}/${item.criticalEquipment}</span>
                <span>Generales mes: ${item.generalReviewedMonth}/${item.generalEquipment}</span>
            </div>
        </article>
    `).join('');
}

function renderHomeFindingSummary(findingSummary) {
    const container = document.getElementById('homeFindingSummary');

    if (!container) {
        return;
    }

    if (!findingSummary.length) {
        container.innerHTML = '<div class="home-empty-state">Aún no hay hallazgos registrados.</div>';
        return;
    }

    container.innerHTML = findingSummary.map((item) => `
        <article class="home-finding-item">
            <div>
                <strong>${escapeHtml(item.label)}</strong>
                <span>${escapeHtml(item.caption)}</span>
            </div>
            <strong class="home-finding-value">${item.count}</strong>
        </article>
    `).join('');
}

function renderHomeCycleSummary(summary) {
    const container = document.getElementById('homeCycleSummary');

    if (!container) {
        return;
    }

    const criticalItems = (summary?.pending?.criticalToday || [])
        .map((item) => `<li>${escapeHtml(item.equipment_key)} - ${escapeHtml(item.equipment_name)} <span>${escapeHtml(item.area || '-')}</span></li>`)
        .join('');
    const generalItems = (summary?.pending?.generalMonth || [])
        .map((item) => `<li>${escapeHtml(item.equipment_key)} - ${escapeHtml(item.equipment_name)} <span>${escapeHtml(item.area || '-')}</span></li>`)
        .join('');

    container.innerHTML = `
        <article class="home-cycle-card">
            <div class="home-cycle-header">
                <strong>Críticos de hoy</strong>
                <span>${summary.coverage.criticalPendingToday} pendientes</span>
            </div>
            <p>La revisión crítica debe completarse diariamente.</p>
            <ul class="home-cycle-list">
                ${criticalItems || '<li>Sin pendientes críticos hoy.</li>'}
            </ul>
        </article>
        <article class="home-cycle-card">
            <div class="home-cycle-header">
                <strong>Generales del mes</strong>
                <span>${summary.coverage.generalPendingMonth} pendientes</span>
            </div>
            <p>La revisión general debe completarse una vez por mes.</p>
            <ul class="home-cycle-list">
                ${generalItems || '<li>Sin pendientes generales este mes.</li>'}
            </ul>
        </article>
    `;
}

function renderHomeCoverageChart(items) {
    const container = document.getElementById('homeCoverageChart');

    if (!container) {
        return;
    }

    if (!items.length) {
        container.innerHTML = '<div class="home-empty-state">No hay equipos para calcular cobertura.</div>';
        return;
    }

    container.innerHTML = items.map((item) => `
        <article class="home-chart-row">
            <div class="home-chart-labels">
                <strong>${escapeHtml(item.label)}</strong>
                <span>${item.reviewed}/${item.total} revisados</span>
            </div>
            <div class="home-progress-track">
                <span class="home-progress-fill ${escapeHtml(item.variant)}" style="width: ${item.percentage}%;"></span>
            </div>
            <strong class="home-chart-value">${item.percentage}%</strong>
        </article>
    `).join('');
}

function renderHomeAreaChart(items) {
    const container = document.getElementById('homeAreaChart');

    if (!container) {
        return;
    }

    if (!items.length) {
        container.innerHTML = '<div class="home-empty-state">No hay datos por área para mostrar.</div>';
        return;
    }

    const maxEquipment = Math.max(...items.map((item) => item.totalEquipment), 1);
    const maxReports = Math.max(...items.map((item) => item.openReports), 1);

    container.innerHTML = items.map((item) => `
        <article class="home-area-bar-card">
            <div class="home-chart-labels">
                <strong>${escapeHtml(item.area)}</strong>
                <span>${item.totalEquipment} equipos · ${item.openReports} abiertos</span>
            </div>
            <div class="home-bar-stack">
                <div class="home-bar-line">
                    <span class="home-bar-caption">Equipos</span>
                    <div class="home-progress-track">
                        <span class="home-progress-fill home-progress-fill-neutral" style="width: ${(item.totalEquipment / maxEquipment) * 100}%;"></span>
                    </div>
                </div>
                <div class="home-bar-line">
                    <span class="home-bar-caption">Abiertos</span>
                    <div class="home-progress-track">
                        <span class="home-progress-fill home-progress-fill-alert" style="width: ${maxReports ? (item.openReports / maxReports) * 100 : 0}%;"></span>
                    </div>
                </div>
            </div>
        </article>
    `).join('');
}

function renderHomePriorityList(reports) {
    const container = document.getElementById('homePriorityList');

    if (!container) {
        return;
    }

    if (!reports.length) {
        container.innerHTML = `
            <article class="report-card">
                <p class="report-desc">No hay prioridades abiertas en este momento.</p>
            </article>
        `;
        return;
    }

    container.innerHTML = reports.map((item) => {
        const findings = getReportFindings(item, true);
        const findingsHtml = findings.length
            ? findings.map((finding) => `<span class="report-flag ${finding.className}">${escapeHtml(finding.label)}</span>`).join('')
            : '<span class="muted-text">Sin hallazgos clasificados</span>';

        return `
            <article class="report-card home-priority-card">
                <div class="report-card-top">
                    <div>
                        <span class="report-title">${escapeHtml(item.equipment_key)} - ${escapeHtml(item.equipment_name)}</span>
                        <span class="report-area-label">${item.critical ? 'Crítico' : 'General'} · Área: ${escapeHtml(item.area || '-')}</span>
                    </div>
                    <span class="report-days">${escapeHtml(formatRelativeDate(item.date))}</span>
                </div>
                <div class="report-flags">
                    ${findingsHtml}
                </div>
                <p class="report-desc">${escapeHtml(String(item.comments || '').trim() || 'Sin comentarios registrados.')}</p>
                ${item.finding_closed ? '' : `<button class="btn-table-action report-action-btn" type="button" data-close-report="${item.id}">Atender</button>`}
            </article>
        `;
    }).join('');

    container.querySelectorAll('[data-close-report]').forEach((button) => {
        button.addEventListener('click', () => saveReportAction(button.dataset.closeReport));
    });
}

async function loadHomeDashboard() {
    if (!document.getElementById('home-page')) {
        return;
    }

    setupHomeDashboardLayout();

    try {
        const [summary, reports] = await Promise.all([
            API.get('/api/dashboard-summary'),
            API.get('/api/reports')
        ]);

        const openReports = reports.filter((item) => !item.finding_closed && hasReportFinding(item));

        const findingSummary = [
            {
                label: 'Sobrecarga',
                caption: 'Registros por arriba de la corriente nominal',
                count: reports.filter((item) => item.overloaded).length
            },
            {
                label: 'Vibración',
                caption: 'Inspecciones con vibración detectada',
                count: reports.filter((item) => item.vibration).length
            },
            {
                label: 'Ruido',
                caption: 'Inspecciones con ruido anormal',
                count: reports.filter((item) => item.noise).length
            },
            {
                label: 'Limpieza',
                caption: 'Equipos que requieren limpieza',
                count: reports.filter((item) => item.cleaning_required).length
            },
            {
                label: 'Comentarios',
                caption: 'Revisiones con observaciones registradas',
                count: reports.filter((item) => String(item.comments || '').trim()).length
            }
        ].filter((item) => item.count > 0);

        const priorityReports = [...openReports]
            .sort((left, right) => {
                const leftScore = (left.critical ? 4 : 0) + (left.overloaded ? 3 : 0) + (left.vibration ? 2 : 0) + (left.noise ? 2 : 0);
                const rightScore = (right.critical ? 4 : 0) + (right.overloaded ? 3 : 0) + (right.vibration ? 2 : 0) + (right.noise ? 2 : 0);

                if (rightScore !== leftScore) {
                    return rightScore - leftScore;
                }

                return new Date(right.date) - new Date(left.date);
            })
            .slice(0, 5);

        const areaSummary = [...summary.areas]
            .sort((left, right) => {
                if (right.openReports !== left.openReports) {
                    return right.openReports - left.openReports;
                }

                return right.totalEquipment - left.totalEquipment;
            });

        const coverageSummary = [
            {
                label: 'Críticos hoy',
                reviewed: summary.coverage.criticalReviewedToday,
                total: summary.totals.criticalEquipment,
                percentage: summary.totals.criticalEquipment ? Math.round((summary.coverage.criticalReviewedToday / summary.totals.criticalEquipment) * 100) : 0,
                variant: 'home-progress-fill-critical'
            },
            {
                label: 'Generales del mes',
                reviewed: summary.coverage.generalReviewedMonth,
                total: summary.totals.generalEquipment,
                percentage: summary.totals.generalEquipment ? Math.round((summary.coverage.generalReviewedMonth / summary.totals.generalEquipment) * 100) : 0,
                variant: 'home-progress-fill-neutral'
            },
            {
                label: 'Cobertura total',
                reviewed: summary.coverage.criticalReviewedToday + summary.coverage.generalReviewedMonth,
                total: summary.totals.activeEquipment,
                percentage: summary.totals.activeEquipment ? Math.round(((summary.coverage.criticalReviewedToday + summary.coverage.generalReviewedMonth) / summary.totals.activeEquipment) * 100) : 0,
                variant: 'home-progress-fill-primary'
            }
        ];

        const updatedAt = document.getElementById('homeDashboardUpdatedAt');

        if (updatedAt) {
            updatedAt.textContent = formatDashboardTimestamp();
        }

        const statEquipment = document.getElementById('homeStatEquipment');
        const statCritical = document.getElementById('homeStatCritical');
        const statClosedReports = document.getElementById('homeStatClosedReports');
        const statOverloaded = document.getElementById('homeStatOverloaded');

        if (statEquipment) {
            statEquipment.textContent = summary.totals.activeEquipment;
        }

        if (statCritical) {
            statCritical.textContent = summary.totals.criticalEquipment;
        }

        if (statClosedReports) {
            statClosedReports.textContent = summary.coverage.criticalPendingToday;
        }

        if (statOverloaded) {
            statOverloaded.textContent = summary.coverage.generalPendingMonth;
        }

        setHomeStatValue(
            'homeStatReviewedToday',
            summary.coverage.criticalReviewedToday,
            `${summary.coverage.criticalPendingToday} críticos pendientes hoy`
        );
        setHomeStatValue(
            'homeStatOpenReports',
            summary.coverage.generalReviewedMonth,
            `${summary.coverage.generalPendingMonth} generales pendientes del mes`
        );
        setHomeStatCard('homeStatEquipment', 'Equipos activos', 'Base total para inspección');
        setHomeStatCard('homeStatCritical', 'Equipos críticos', 'Requieren revisión diaria');
        setHomeStatCard('homeStatReviewedToday', 'Críticos revisados hoy');
        setHomeStatCard('homeStatOpenReports', 'Generales revisados este mes');
        setHomeStatCard('homeStatClosedReports', 'Críticos pendientes hoy', `${summary.coverage.criticalPendingToday} faltan por revisar`);
        setHomeStatCard('homeStatOverloaded', 'Generales pendientes del mes', `${summary.coverage.generalPendingMonth} faltan por revisar`);

        renderHomeAreaSummary(areaSummary);
        renderHomeFindingSummary(findingSummary);
        renderHomeCoverageChart(coverageSummary);
        renderHomeAreaChart(areaSummary);
        renderHomeCycleSummary(summary);
        renderHomePriorityList(priorityReports);
    } catch (error) {
        const updatedAt = document.getElementById('homeDashboardUpdatedAt');

        if (updatedAt) {
            updatedAt.textContent = 'No se pudo actualizar';
        }

        renderHomeAreaSummary([]);
        renderHomeFindingSummary([]);
        renderHomeCoverageChart([]);
        renderHomeAreaChart([]);
        const cycleSummary = document.getElementById('homeCycleSummary');
        if (cycleSummary) {
            cycleSummary.innerHTML = '<div class="home-empty-state">No se pudo cargar el control de periodicidad.</div>';
        }
        renderHomePriorityList([]);
    }
}
function formatInputDate(date = new Date()) {
    const offsetMs = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offsetMs).toISOString().slice(0, 10);
}

function initReviewQueryDates() {
    const today = formatInputDate();

    ['criticalQueryDate', 'generalQueryDate'].forEach((inputId) => {
        const input = document.getElementById(inputId);

        if (input && !input.value) {
            input.value = today;
        }
    });
}

async function loadPrintTemplate() {
    try {
        const response = await fetch('/print-template.json');

        if (response.ok) {
            printTemplate = { ...printTemplate, ...(await response.json()) };
        }
    } catch (error) {
        // Keep built-in defaults if the editable template cannot be loaded.
    }

    renderPrintTemplate();
}

function getPrintReviewDate(type) {
    const input = document.getElementById(type === 'critical' ? 'criticalQueryDate' : 'generalQueryDate');
    const rawDate = input?.value || formatInputDate();
    const [year, month, day] = rawDate.split('-');

    if (year && month && day) {
        return `${day}/${month}/${year}`;
    }

    return rawDate;
}

function getPrintReviewArea(type) {
    const input = document.getElementById(type === 'critical' ? 'criticalQueryArea' : 'generalQueryArea');
    return input?.value || 'Todas';
}

function renderPrintTemplate() {
    ['critical', 'general'].forEach((type) => {
        const title = type === 'critical' ? printTemplate.criticalTitle : printTemplate.generalTitle;
        const header = document.querySelector(`[data-print-header="${type}"]`);
        const footer = document.querySelector(`[data-print-footer="${type}"]`);

        if (header) {
            header.innerHTML = `
                <div class="print-logo-cell">
                    <img src="${escapeHtml(printTemplate.logoSrc)}" alt="Logo">
                </div>
                <div class="print-company-cell">
                    ${escapeHtml(printTemplate.companyName)}
                </div>
                <div class="print-title-cell">
                    <span class="print-title-text">${escapeHtml(title || printTemplate.defaultTitle || '')}</span>
                    <span class="print-area-text">Área: ${escapeHtml(getPrintReviewArea(type))}</span>
                </div>
                <div class="print-meta-cell">
                    <span>FECHA:</span>
                    <strong class="print-review-date">${escapeHtml(getPrintReviewDate(type))}</strong>
                </div>
            `;
        }

        if (footer) {
            footer.innerHTML = `
                <span>${escapeHtml(printTemplate.footer?.version || '')}</span>
                <span>${escapeHtml(printTemplate.footer?.edition || '')}</span>
                <strong>${escapeHtml(printTemplate.footer?.code || '')}</strong>
            `;
        }
    });
}

function getReportFindings(item, includeStopped = false) {
    return [
        includeStopped && item.equipment_stopped ? { label: 'Equipo parado', className: 'report-flag-stopped' } : null,
        item.vibration ? { label: 'Vibración', className: 'report-flag-vibration' } : null,
        item.noise ? { label: 'Ruido', className: 'report-flag-noise' } : null,
        item.overloaded ? { label: 'Sobrecargado', className: 'report-flag-overload' } : null,
        item.cleaning_required ? { label: 'Limpieza', className: 'report-flag-dirt' } : null,
        (item.comments || '').trim() ? { label: 'Comentario', className: 'report-flag-comment' } : null
    ].filter(Boolean);
}

function hasClosableFinding(item) {
    return !item.finding_closed && getReportFindings(item, false).length > 0;
}

async function saveReportAction(reportId, currentAction = '') {
    const actionTaken = window.prompt(
        'Describe la acción realizada para atender el hallazgo:',
        currentAction
    );

    if (actionTaken === null) {
        return;
    }

    if (!actionTaken.trim()) {
        showAlert('La acción realizada es obligatoria', 'error');
        return;
    }

    try {
        await API.patch(`/api/reports/${reportId}/close`, {
            action_taken: actionTaken.trim()
        });
        await loadFollowUpReports();
        await loadReports();
        showAlert('Acción guardada', 'success');
    } catch (error) {
        showAlert(error.message || 'No se pudo guardar la acción', 'error');
    }
}

function getReportFilterQuery() {
    const params = new URLSearchParams();
    const area = document.getElementById('reportsAreaFilter')?.value || '';
    const date = document.getElementById('reportsDateFilter')?.value || '';
    const finding = document.getElementById('reportsFindingFilter')?.value || '';

    if (area) {
        params.set('area', area);
    }

    if (date) {
        params.set('date', date);
    }

    if (finding) {
        params.set('finding', finding);
    }

    const query = params.toString();
    return query ? `?${query}` : '';
}

function renderReportsTable(reports) {
    const tableBody = document.getElementById('reportsTableBody');

    if (!tableBody) {
        return;
    }

    if (!reports.length) {
        tableBody.innerHTML = '<tr><td class="empty-row" colspan="11">Sin reportes con los filtros seleccionados</td></tr>';
        return;
    }

    tableBody.innerHTML = reports.map((item) => {
        const findings = getReportFindings(item, true);
        const findingsHtml = findings.length
            ? findings.map((finding) => `<span class="report-flag ${finding.className}">${escapeHtml(finding.label)}</span>`).join('')
            : '';
        const temperature = item.equipment_stopped ? '-' : `${escapeHtml(item.temperature)} \u00b0C`;
        const current = item.equipment_stopped ? '-' : `${escapeHtml(item.current)} A`;
        const actionHtml = item.finding_closed
            ? `
                <div class="action-note">
                    <strong>Cerrado</strong>
                    <span>${escapeHtml(item.action_taken || '-')}</span>
                    ${item.closed_by_username ? `<small>Por ${escapeHtml(item.closed_by_username)}</small>` : ''}
                    <button class="btn-table-action action-edit-btn" type="button" data-edit-closed-report="${item.id}">
                        Editar
                    </button>
                </div>
            `
            : hasClosableFinding(item)
                ? `<button class="btn-table-action" type="button" data-close-report="${item.id}">Atender</button>`
                : '<span class="muted-text">Sin acción pendiente</span>';

        return `
            <tr>
                <td>${escapeHtml(formatRecordDate(item.date))}</td>
                <td>${item.critical ? 'Cr\u00edtica' : 'General'}</td>
                <td>${escapeHtml(item.area || '-')}</td>
                <td>${escapeHtml(item.equipment_key)}</td>
                <td>${escapeHtml(item.equipment_name)}</td>
                <td>${temperature}</td>
                <td>${current}</td>
                <td><div class="report-flags report-flags-table">${findingsHtml}</div></td>
                <td>${escapeHtml(item.comments || '-')}</td>
                <td>${actionHtml}</td>
                <td>${escapeHtml(item.username || '-')}</td>
            </tr>
        `;
    }).join('');

    document.querySelectorAll('[data-close-report]').forEach((button) => {
        button.addEventListener('click', () => saveReportAction(button.dataset.closeReport));
    });

    document.querySelectorAll('[data-edit-closed-report]').forEach((button) => {
        button.addEventListener('click', () => {
            const report = reports.find((item) => String(item.id) === String(button.dataset.editClosedReport));
            saveReportAction(button.dataset.editClosedReport, report?.action_taken || '');
        });
    });
}

async function loadReports() {
    const tableBody = document.getElementById('reportsTableBody');

    if (!tableBody) {
        return;
    }

    try {
        renderReportsTable(await API.get(`/api/reports${getReportFilterQuery()}`));
    } catch (error) {
        tableBody.innerHTML = '<tr><td class="empty-row" colspan="11">No se pudieron cargar los reportes</td></tr>';
    }
}

function renderFollowUpReports(reports) {
    const reportList = document.getElementById('followUpReportList');

    if (!reportList) {
        return;
    }

    if (!reports.length) {
        reportList.innerHTML = `
            <article class="report-card">
                <p class="report-desc">No hay equipos con hallazgos pendientes de seguimiento.</p>
            </article>
        `;
        return;
    }

    reportList.innerHTML = reports.map((item) => {
        const comments = (item.comments || '').trim();

        return `
            <article class="report-card">
                <div class="report-card-top">
                    <div>
                        <span class="report-title">${escapeHtml(item.equipment_key)} - ${escapeHtml(item.equipment_name)}</span>
                        <span class="report-area-label">Área: ${escapeHtml(item.area || '-')}</span>
                    </div>
                    <span class="report-days">${escapeHtml(formatRelativeDate(item.date))}</span>
                </div>
                <p class="report-desc">
                    ${item.equipment_stopped
                        ? 'Equipo parado, sin valores registrados'
                        : `Temperatura: ${escapeHtml(item.temperature)} °C · Corriente: ${escapeHtml(item.current)} A${item.nominal_current ? ` · Nominal: ${escapeHtml(item.nominal_current)} A` : ''}`}
                    ${comments ? `<br>Comentarios: ${escapeHtml(comments)}` : ''}
                </p>
                <div class="report-flags">
                    ${getReportFindings(item).map((finding) => `
                        <span class="report-flag ${finding.className}">${escapeHtml(finding.label)}</span>
                    `).join('')}
                </div>
                <button class="btn-table-action report-action-btn" type="button" data-close-report="${item.id}">
                    Atender
                </button>
            </article>
        `;
    }).join('');

    reportList.querySelectorAll('[data-close-report]').forEach((button) => {
        button.addEventListener('click', () => saveReportAction(button.dataset.closeReport));
    });
}

async function loadFollowUpReports() {
    const reportList = document.getElementById('followUpReportList');

    if (!reportList) {
        return;
    }

    try {
        const area = document.getElementById('reportAreaSelect')?.value || '';
        const query = area ? `?area=${encodeURIComponent(area)}` : '';
        renderFollowUpReports(await API.get(`/api/follow-up-reports${query}`));
    } catch (error) {
        reportList.innerHTML = `
            <article class="report-card">
                <p class="report-desc">No se pudieron cargar los reportes de seguimiento.</p>
            </article>
        `;
    }
}

async function refreshEquipmentDatabase() {
    const equipment = await loadEquipment();
    renderEquipment(equipment);
    await loadDailyReadings();
    await loadFollowUpReports();
    await loadReports();
    await loadReviewQuery(true);
    await loadReviewQuery(false);
}

function getSelectedUserPermissions() {
    return [...document.querySelectorAll('[data-user-permission]:checked')]
        .map((input) => input.value);
}

function setSelectedUserPermissions(permissions) {
    document.querySelectorAll('[data-user-permission]').forEach((input) => {
        input.checked = permissions.includes(input.value);
    });
}

function renderUserPermissionInputs() {
    const container = document.getElementById('userPermissions');

    if (!container) {
        return;
    }

    container.innerHTML = Object.entries(PERMISSION_LABELS).map(([permission, label]) => `
        <label class="inline-check permission-check">
            <input type="checkbox" value="${escapeHtml(permission)}" data-user-permission>
            <span>${escapeHtml(label)}</span>
        </label>
    `).join('');
}

function resetUserForm() {
    const form = document.getElementById('userForm');

    if (!form) {
        return;
    }

    form.reset();
    document.getElementById('userId').value = '';
    document.getElementById('userRole').value = 'viewer';
    document.getElementById('userPassword').required = true;
    document.getElementById('userPassword').placeholder = 'Contraseña';
    document.getElementById('userSubmitBtn').textContent = 'Guardar usuario';
    document.getElementById('userCancelBtn').style.display = 'none';
    setSelectedUserPermissions(ROLE_PERMISSIONS.viewer);
}

function setUserFormMode(user) {
    document.getElementById('userId').value = user.id;
    document.getElementById('userUsername').value = user.username || '';
    document.getElementById('userPassword').value = '';
    document.getElementById('userPassword').required = false;
    document.getElementById('userPassword').placeholder = 'Nueva contraseña (opcional)';
    document.getElementById('userRole').value = user.role || 'viewer';
    document.getElementById('userSubmitBtn').textContent = 'Actualizar usuario';
    document.getElementById('userCancelBtn').style.display = 'inline-block';
    setSelectedUserPermissions(user.permissions || ROLE_PERMISSIONS[user.role] || []);
}

function renderUsers(users) {
    const tableBody = document.getElementById('usersTableBody');

    if (!tableBody) {
        return;
    }

    tableBody.innerHTML = users.length
        ? users.map((user) => `
            <tr>
                <td>${escapeHtml(user.username)}</td>
                <td>${escapeHtml(user.role)}</td>
                <td>
                    <div class="permission-tags">
                        ${(user.permissions || []).map((permission) => `
                            <span>${escapeHtml(PERMISSION_LABELS[permission] || permission)}</span>
                        `).join('')}
                    </div>
                </td>
                <td>
                    <button class="btn-table-action" type="button" data-edit-user="${user.id}">
                        Editar
                    </button>
                </td>
            </tr>
        `).join('')
        : '<tr><td class="empty-row" colspan="4">Sin usuarios registrados</td></tr>';

    document.querySelectorAll('[data-edit-user]').forEach((button) => {
        button.addEventListener('click', () => {
            const user = users.find((item) => String(item.id) === String(button.dataset.editUser));

            if (user) {
                setUserFormMode(user);
            }
        });
    });
}

async function loadUsers() {
    const tableBody = document.getElementById('usersTableBody');

    if (!tableBody) {
        return;
    }

    try {
        renderUsers(await API.get('/api/users'));
    } catch (error) {
        tableBody.innerHTML = '<tr><td class="empty-row" colspan="4">No se pudieron cargar los usuarios</td></tr>';
    }
}

function initUserManagement(user) {
    const form = document.getElementById('userForm');
    const usersNavItem = document.querySelector('.nav-item[data-page="users"]');

    if (!form) {
        return;
    }

    renderUserPermissionInputs();
    resetUserForm();

    if (!user.permissions?.includes('users:read')) {
        usersNavItem?.remove();
        return;
    }

    if (!user.permissions?.includes('users:create')) {
        form.style.display = 'none';
    }

    document.getElementById('userRole')?.addEventListener('change', (event) => {
        setSelectedUserPermissions(ROLE_PERMISSIONS[event.target.value] || ROLE_PERMISSIONS.viewer);
    });

    document.getElementById('applyRolePermissions')?.addEventListener('click', () => {
        const role = document.getElementById('userRole').value;
        setSelectedUserPermissions(ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.viewer);
    });

    document.getElementById('userCancelBtn')?.addEventListener('click', resetUserForm);

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const userId = document.getElementById('userId').value;
        const password = document.getElementById('userPassword').value;
        const payload = {
            username: document.getElementById('userUsername').value.trim(),
            role: document.getElementById('userRole').value,
            permissions: getSelectedUserPermissions()
        };

        if (password) {
            payload.password = password;
        }

        try {
            if (userId) {
                await API.put(`/api/users/${userId}`, payload);
                showAlert('Usuario actualizado', 'success');
            } else {
                await API.post('/api/users', payload);
                showAlert('Usuario creado', 'success');
            }

            resetUserForm();
            await loadUsers();
        } catch (error) {
            showAlert(error.message || 'No se pudo guardar el usuario', 'error');
        }
    });

    loadUsers();
}

function initEquipmentDatabase(user) {
    const equipmentForm = document.getElementById('equipmentForm');

    if (equipmentForm && !user.permissions?.includes('motors:create')) {
        equipmentForm.style.display = 'none';
    }

    document.getElementById('equipmentAreaFilter')?.addEventListener('change', async () => {
        renderEquipment(await loadEquipment());
    });
    document.getElementById('equipmentTypeFilter')?.addEventListener('change', async () => {
        renderEquipment(await loadEquipment());
    });

    document.getElementById('equipmentCancelBtn')?.addEventListener('click', resetEquipmentForm);
    document.getElementById('readingArea')?.addEventListener('change', refreshReviewEquipmentOptions);
    document.getElementById('criticalReadingArea')?.addEventListener('change', refreshReviewEquipmentOptions);
    document.getElementById('currentReadingArea')?.addEventListener('change', refreshReviewEquipmentOptions);
    document.getElementById('criticalCurrentArea')?.addEventListener('change', refreshReviewEquipmentOptions);

    refreshEquipmentDatabase().catch((error) => {
        showAlert(error.message || 'Error al cargar equipos', 'error');
    });

    equipmentForm?.addEventListener('submit', async (event) => {
        event.preventDefault();

        const equipmentId = document.getElementById('equipmentId').value;
        const payload = {
            equipment_key: document.getElementById('equipmentKey').value,
            name: document.getElementById('equipmentName').value,
            area: document.getElementById('equipmentArea').value,
            nominal_current: document.getElementById('equipmentNominalCurrent').value,
            critical: document.getElementById('equipmentCritical').checked,
            active: document.getElementById('equipmentActive').checked
        };

        try {
            if (equipmentId) {
                await API.put(`/api/equipment/${equipmentId}`, payload);
            } else {
                await API.post('/api/equipment', payload);
            }

            resetEquipmentForm();
            await refreshEquipmentDatabase();
            showPage('equipment');
            showAlert(equipmentId ? 'Equipo actualizado' : 'Equipo guardado', 'success');
        } catch (error) {
            showAlert(error.message || 'Error al guardar equipo', 'error');
        }
    });

    setupReadingForm({
        formId: 'dailyReadingForm',
        areaId: 'readingArea',
        equipmentId: 'readingEquipment',
        stoppedId: 'readingStopped',
        temperatureId: 'readingTemperature',
        vibrationId: 'readingVibration',
        noiseId: 'readingNoise',
        cleaningId: 'readingCleaning',
        commentsId: 'readingComments',
        page: 'general'
    });

    setupCurrentForm({
        formId: 'currentReadingForm',
        areaId: 'currentReadingArea',
        equipmentId: 'currentReadingEquipment',
        currentId: 'currentReadingValue',
        page: 'general'
    });

    setupReadingForm({
        formId: 'criticalReadingForm',
        areaId: 'criticalReadingArea',
        equipmentId: 'criticalReadingEquipment',
        stoppedId: 'criticalReadingStopped',
        temperatureId: 'criticalReadingTemperature',
        vibrationId: 'criticalReadingVibration',
        noiseId: 'criticalReadingNoise',
        cleaningId: 'criticalReadingCleaning',
        commentsId: 'criticalReadingComments',
        page: 'critical'
    });

    setupCurrentForm({
        formId: 'criticalCurrentForm',
        areaId: 'criticalCurrentArea',
        equipmentId: 'criticalCurrentEquipment',
        currentId: 'criticalCurrentValue',
        page: 'critical'
    });
}

function setupReadingForm(config) {
    const form = document.getElementById(config.formId);

    if (!form) {
        return;
    }

    const stoppedInput = document.getElementById(config.stoppedId);
    const temperatureInput = document.getElementById(config.temperatureId);

    stoppedInput?.addEventListener('change', () => {
        const stopped = stoppedInput.checked;
        temperatureInput.required = !stopped;
        temperatureInput.disabled = stopped;

        if (stopped) {
            temperatureInput.value = '';
        }
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        try {
            const stopped = document.getElementById(config.stoppedId).checked;
            const equipmentId = document.getElementById(config.equipmentId).value;

            if (!equipmentId) {
                showAlert('Selecciona un equipo del área indicada', 'error');
                return;
            }

            await API.post('/api/daily-readings', {
                motor_id: equipmentId,
                reading_section: 'physical',
                equipment_stopped: stopped,
                temperature: stopped ? null : Number(document.getElementById(config.temperatureId).value),
                vibration: document.getElementById(config.vibrationId).checked,
                noise: document.getElementById(config.noiseId).checked,
                cleaning_required: document.getElementById(config.cleaningId).checked,
                comments: document.getElementById(config.commentsId).value
            });

            form.reset();
            document.getElementById(config.areaId).value = '';
            refreshReviewEquipmentOptions();
            temperatureInput.required = true;
            temperatureInput.disabled = false;
            await loadDailyReadings();
            await loadFollowUpReports();
            await loadReports();
            await loadReviewQuery(true);
            await loadReviewQuery(false);
            showPage(config.page);
            showAlert('Revisión física guardada', 'success');
        } catch (error) {
            showAlert(error.message || 'Error al guardar revisión física', 'error');
        }
    });
}

function setupCurrentForm(config) {
    const form = document.getElementById(config.formId);

    if (!form) {
        return;
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const equipmentId = document.getElementById(config.equipmentId).value;

        if (!equipmentId) {
            showAlert('Selecciona un equipo del área indicada', 'error');
            return;
        }

        try {
            await API.post('/api/daily-readings', {
                motor_id: equipmentId,
                reading_section: 'current',
                current: Number(document.getElementById(config.currentId).value)
            });

            form.reset();
            document.getElementById(config.areaId).value = '';
            refreshReviewEquipmentOptions();
            await loadDailyReadings();
            await loadFollowUpReports();
            await loadReports();
            await loadReviewQuery(true);
            await loadReviewQuery(false);
            showPage(config.page);
            showAlert('Corriente guardada', 'success');
        } catch (error) {
            showAlert(error.message || 'Error al guardar corriente', 'error');
        }
    });
}

function setEquipmentFormMode(item) {
    document.getElementById('equipmentId').value = item.id;
    document.getElementById('equipmentKey').value = item.equipment_key || '';
    document.getElementById('equipmentName').value = item.name || '';
    document.getElementById('equipmentArea').value = item.area || '';
    document.getElementById('equipmentNominalCurrent').value = item.nominal_current ?? '';
    document.getElementById('equipmentCritical').checked = Boolean(item.critical);
    document.getElementById('equipmentActive').checked = Boolean(item.active);
    document.getElementById('equipmentSubmitBtn').textContent = 'Actualizar equipo';
    document.getElementById('equipmentCancelBtn').style.display = 'inline-block';
    showPage('equipment');
}

function resetEquipmentForm() {
    const equipmentForm = document.getElementById('equipmentForm');

    if (!equipmentForm) {
        return;
    }

    equipmentForm.reset();
    document.getElementById('equipmentId').value = '';
    document.getElementById('equipmentActive').checked = true;
    document.getElementById('equipmentSubmitBtn').textContent = 'Guardar equipo';
    document.getElementById('equipmentCancelBtn').style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
    initLogin();
    initDashboard();
});
