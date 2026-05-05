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

    initEquipmentDatabase(user);
    loadFollowUpReports();
    loadReports();
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
}

function renderEquipment(equipment) {
    equipmentCache = equipment;
    const tableBody = document.getElementById('equipmentTableBody');
    const areaFilter = document.getElementById('equipmentAreaFilter');
    const selectedArea = areaFilter?.value || '';
    const visibleEquipment = selectedArea
        ? equipment.filter((item) => item.area === selectedArea)
        : equipment;

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
                item.equipment_stopped ? 'Equipo parado' : '',
                item.overloaded ? 'Sobrecargado' : '',
                item.vibration ? 'Vibración' : '',
                item.noise ? 'Ruido' : '',
                item.cleaning_required ? 'Limpieza' : ''
            ].filter(Boolean).join(', ') || '-';
            const temperature = item.equipment_stopped ? '-' : `${escapeHtml(item.temperature)} °C`;
            const current = item.equipment_stopped ? '-' : `${escapeHtml(item.current)} A`;

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

async function closeReportFinding(reportId) {
    const actionTaken = window.prompt('Describe la acción realizada para atender el hallazgo:');

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
        showAlert('Hallazgo cerrado', 'success');
    } catch (error) {
        showAlert(error.message || 'No se pudo cerrar el hallazgo', 'error');
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
            : '<span class="report-flag">Sin hallazgos</span>';
        const temperature = item.equipment_stopped ? '-' : `${escapeHtml(item.temperature)} \u00b0C`;
        const current = item.equipment_stopped ? '-' : `${escapeHtml(item.current)} A`;
        const actionHtml = item.finding_closed
            ? `
                <div class="action-note">
                    <strong>Cerrado</strong>
                    <span>${escapeHtml(item.action_taken || '-')}</span>
                    ${item.closed_by_username ? `<small>Por ${escapeHtml(item.closed_by_username)}</small>` : ''}
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
        button.addEventListener('click', () => closeReportFinding(button.dataset.closeReport));
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
        button.addEventListener('click', () => closeReportFinding(button.dataset.closeReport));
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
}

function initEquipmentDatabase(user) {
    const equipmentForm = document.getElementById('equipmentForm');

    if (equipmentForm && !user.permissions?.includes('motors:create')) {
        equipmentForm.style.display = 'none';
    }

    document.getElementById('equipmentAreaFilter')?.addEventListener('change', async () => {
        renderEquipment(await loadEquipment());
    });

    document.getElementById('equipmentCancelBtn')?.addEventListener('click', resetEquipmentForm);
    document.getElementById('readingArea')?.addEventListener('change', refreshReviewEquipmentOptions);
    document.getElementById('criticalReadingArea')?.addEventListener('change', refreshReviewEquipmentOptions);

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
        currentId: 'readingCurrent',
        vibrationId: 'readingVibration',
        noiseId: 'readingNoise',
        cleaningId: 'readingCleaning',
        commentsId: 'readingComments',
        page: 'general'
    });

    setupReadingForm({
        formId: 'criticalReadingForm',
        areaId: 'criticalReadingArea',
        equipmentId: 'criticalReadingEquipment',
        stoppedId: 'criticalReadingStopped',
        temperatureId: 'criticalReadingTemperature',
        currentId: 'criticalReadingCurrent',
        vibrationId: 'criticalReadingVibration',
        noiseId: 'criticalReadingNoise',
        cleaningId: 'criticalReadingCleaning',
        commentsId: 'criticalReadingComments',
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
    const currentInput = document.getElementById(config.currentId);

    stoppedInput?.addEventListener('change', () => {
        const stopped = stoppedInput.checked;
        temperatureInput.required = !stopped;
        currentInput.required = !stopped;
        temperatureInput.disabled = stopped;
        currentInput.disabled = stopped;

        if (stopped) {
            temperatureInput.value = '';
            currentInput.value = '';
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
                equipment_stopped: stopped,
                temperature: stopped ? null : Number(document.getElementById(config.temperatureId).value),
                current: stopped ? null : Number(document.getElementById(config.currentId).value),
                vibration: document.getElementById(config.vibrationId).checked,
                noise: document.getElementById(config.noiseId).checked,
                cleaning_required: document.getElementById(config.cleaningId).checked,
                comments: document.getElementById(config.commentsId).value
            });

            form.reset();
            document.getElementById(config.areaId).value = '';
            refreshReviewEquipmentOptions();
            temperatureInput.required = true;
            currentInput.required = true;
            temperatureInput.disabled = false;
            currentInput.disabled = false;
            await loadDailyReadings();
            await loadFollowUpReports();
            await loadReports();
            showPage(config.page);
            showAlert('Recorrido guardado', 'success');
        } catch (error) {
            showAlert(error.message || 'Error al guardar recorrido', 'error');
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
