const swaggerJsdoc = require('swagger-jsdoc');

module.exports = swaggerJsdoc({
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'API Sistema de Monitoreo',
            version: '1.0.0',
            description: 'Documentacion base de la API para mantenimiento e inspeccion de equipos.'
        },
        servers: [
            {
                url: 'http://localhost:3000',
                description: 'Servidor local'
            }
        ],
        components: {
            securitySchemes: {
                UserIdHeader: {
                    type: 'apiKey',
                    in: 'header',
                    name: 'x-user-id',
                    description: 'Id del usuario autenticado. La API actual usa este header para permisos.'
                }
            },
            schemas: {
                ApiMessage: {
                    type: 'object',
                    properties: {
                        message: {
                            type: 'string',
                            example: 'Operacion completada'
                        }
                    }
                },
                User: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer', example: 1 },
                        username: { type: 'string', example: 'admin' },
                        role: { type: 'string', example: 'admin' },
                        permissions: {
                            type: 'array',
                            items: { type: 'string' },
                            example: ['users:create', 'users:read', 'motors:create']
                        }
                    }
                },
                LoginRequest: {
                    type: 'object',
                    required: ['username', 'password'],
                    properties: {
                        username: { type: 'string', example: 'admin' },
                        password: { type: 'string', example: '1234' }
                    }
                },
                UserInput: {
                    type: 'object',
                    required: ['username'],
                    properties: {
                        username: { type: 'string', example: 'tecnico1' },
                        password: { type: 'string', example: '1234' },
                        role: { type: 'string', example: 'technician' },
                        permissions: {
                            type: 'array',
                            items: { type: 'string' },
                            example: ['motors:read', 'inspections:create']
                        }
                    }
                },
                Equipment: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer', example: 10 },
                        equipment_key: { type: 'string', example: 'MP2-010' },
                        name: { type: 'string', example: 'M.B. Vacio no. 1' },
                        area: { type: 'string', example: 'Maquina no. 2' },
                        nominal_current: { type: 'number', nullable: true, example: 32.5 },
                        critical: { type: 'integer', enum: [0, 1], example: 1 },
                        active: { type: 'integer', enum: [0, 1], example: 1 }
                    }
                },
                EquipmentInput: {
                    type: 'object',
                    required: ['equipment_key', 'name', 'area'],
                    properties: {
                        equipment_key: { type: 'string', example: 'MP2-099' },
                        name: { type: 'string', example: 'Motor prueba' },
                        area: {
                            type: 'string',
                            enum: ['Central de pastas', 'Maquina no. 2', 'Maquina no. 3'],
                            example: 'Central de pastas'
                        },
                        nominal_current: { type: 'number', nullable: true, example: 28.7 },
                        critical: { type: 'integer', enum: [0, 1], example: 1 },
                        active: { type: 'integer', enum: [0, 1], example: 1 }
                    }
                },
                InspectionInput: {
                    type: 'object',
                    properties: {
                        equipment_key: { type: 'string', example: 'MP2-010' },
                        motor_id: { type: 'integer', example: 10 },
                        temperature: { type: 'number', nullable: true, example: 67.5 },
                        current: { type: 'number', nullable: true, example: 31.2 },
                        equipment_stopped: { type: 'boolean', example: false },
                        reading_section: {
                            type: 'string',
                            enum: ['full', 'current', 'physical'],
                            example: 'full'
                        },
                        cleaning_required: { type: 'boolean', example: false },
                        dirty: { type: 'boolean', example: false },
                        noise: { type: 'boolean', example: false },
                        vibration: { type: 'boolean', example: true },
                        comments: { type: 'string', example: 'Se detecta vibracion ligera.' }
                    }
                },
                ReportCloseInput: {
                    type: 'object',
                    required: ['action_taken'],
                    properties: {
                        action_taken: { type: 'string', example: 'Se ajusto base y se verifico operacion.' }
                    }
                },
                HealthResponse: {
                    type: 'object',
                    properties: {
                        status: { type: 'string', example: 'ok' },
                        message: { type: 'string', example: 'Servidor funcionando correctamente' }
                    }
                },
                LoginResponse: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: true },
                        user: { $ref: '#/components/schemas/User' }
                    }
                },
                SuccessResponse: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: true }
                    }
                },
                Report: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer', example: 15 },
                        date: { type: 'string', example: '2026-05-21 08:30:00' },
                        username: { type: 'string', nullable: true, example: 'tecnico1' },
                        equipment_key: { type: 'string', example: 'MP2-010' },
                        equipment_name: { type: 'string', example: 'M.B. Vacio no. 1' },
                        area: { type: 'string', example: 'Maquina no. 2' },
                        critical: { type: 'integer', nullable: true, example: 1 },
                        nominal_current: { type: 'number', nullable: true, example: 32.5 },
                        temperature: { type: 'number', nullable: true, example: 68.4 },
                        current: { type: 'number', nullable: true, example: 33.8 },
                        overloaded: { type: 'integer', example: 1 },
                        equipment_stopped: { type: 'integer', example: 0 },
                        vibration: { type: 'integer', example: 1 },
                        noise: { type: 'integer', example: 0 },
                        cleaning_required: { type: 'integer', example: 0 },
                        comments: { type: 'string', nullable: true, example: 'Revisar alineacion.' },
                        action_taken: { type: 'string', nullable: true, example: 'Ajuste realizado.' },
                        finding_closed: { type: 'integer', nullable: true, example: 0 },
                        closed_at: { type: 'string', nullable: true, example: '2026-05-21 10:00:00' },
                        closed_by_username: { type: 'string', nullable: true, example: 'admin' }
                    }
                },
                DashboardSummary: {
                    type: 'object',
                    properties: {
                        today: { type: 'string', example: '2026-05-21' },
                        month: { type: 'string', example: '2026-05' },
                        totals: {
                            type: 'object',
                            properties: {
                                activeEquipment: { type: 'integer', example: 732 },
                                criticalEquipment: { type: 'integer', example: 133 },
                                generalEquipment: { type: 'integer', example: 599 }
                            }
                        },
                        coverage: {
                            type: 'object',
                            properties: {
                                criticalReviewedToday: { type: 'integer', example: 1 },
                                criticalPendingToday: { type: 'integer', example: 132 },
                                generalReviewedMonth: { type: 'integer', example: 0 },
                                generalPendingMonth: { type: 'integer', example: 599 }
                            }
                        },
                        areas: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    area: { type: 'string', example: 'Central de pastas' },
                                    totalEquipment: { type: 'integer', example: 230 },
                                    criticalEquipment: { type: 'integer', example: 40 },
                                    generalEquipment: { type: 'integer', example: 190 },
                                    criticalReviewedToday: { type: 'integer', example: 1 },
                                    generalReviewedMonth: { type: 'integer', example: 0 },
                                    openReports: { type: 'integer', example: 0 }
                                }
                            }
                        },
                        pending: {
                            type: 'object',
                            properties: {
                                criticalToday: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            equipment_key: { type: 'string', example: 'CPD-0285-PPPSC' },
                                            equipment_name: { type: 'string', example: 'MB TQ. PASTA ESP. SIST. CARA M2' },
                                            area: { type: 'string', example: 'Central de pastas' }
                                        }
                                    }
                                },
                                generalMonth: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            equipment_key: { type: 'string', example: 'CPD-0010-PPPS' },
                                            equipment_name: { type: 'string', example: 'MB ALIM. LIMP. ALTA CONSISTENCIA SIST. CARA' },
                                            area: { type: 'string', example: 'Central de pastas' }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        paths: {
            '/api/health': {
                get: {
                    tags: ['Sistema'],
                    summary: 'Verifica el estado del servidor',
                    responses: {
                        200: {
                            description: 'Servidor disponible',
                            content: {
                                'application/json': {
                                    schema: { $ref: '#/components/schemas/HealthResponse' }
                                }
                            }
                        }
                    }
                }
            },
            '/api/login': {
                post: {
                    tags: ['Autenticacion'],
                    summary: 'Inicia sesion en el sistema',
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/LoginRequest' }
                            }
                        }
                    },
                    responses: {
                        200: {
                            description: 'Login correcto',
                            content: {
                                'application/json': {
                                    schema: { $ref: '#/components/schemas/LoginResponse' }
                                }
                            }
                        },
                        400: { description: 'Faltan credenciales' },
                        401: { description: 'Credenciales invalidas' }
                    }
                }
            },
            '/api/users': {
                get: {
                    tags: ['Usuarios'],
                    summary: 'Lista usuarios',
                    security: [{ UserIdHeader: [] }],
                    responses: {
                        200: {
                            description: 'Listado de usuarios',
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'array',
                                        items: { $ref: '#/components/schemas/User' }
                                    }
                                }
                            }
                        },
                        401: { description: 'Usuario requerido o invalido' },
                        403: { description: 'Sin permisos' }
                    }
                },
                post: {
                    tags: ['Usuarios'],
                    summary: 'Crea un usuario',
                    security: [{ UserIdHeader: [] }],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/UserInput' }
                            }
                        }
                    },
                    responses: {
                        201: { description: 'Usuario creado' },
                        409: { description: 'Usuario duplicado' }
                    }
                }
            },
            '/api/users/{id}': {
                put: {
                    tags: ['Usuarios'],
                    summary: 'Actualiza un usuario',
                    security: [{ UserIdHeader: [] }],
                    parameters: [
                        {
                            name: 'id',
                            in: 'path',
                            required: true,
                            schema: { type: 'integer' }
                        }
                    ],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/UserInput' }
                            }
                        }
                    },
                    responses: {
                        200: { description: 'Usuario actualizado' },
                        404: { description: 'Usuario no encontrado' }
                    }
                }
            },
            '/api/equipment': {
                get: {
                    tags: ['Equipos'],
                    summary: 'Lista equipos',
                    security: [{ UserIdHeader: [] }],
                    parameters: [
                        {
                            name: 'includeInactive',
                            in: 'query',
                            required: false,
                            schema: { type: 'string', enum: ['0', '1'] },
                            description: 'Usa 1 para incluir equipos inactivos'
                        }
                    ],
                    responses: {
                        200: {
                            description: 'Listado de equipos',
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'array',
                                        items: { $ref: '#/components/schemas/Equipment' }
                                    }
                                }
                            }
                        }
                    }
                },
                post: {
                    tags: ['Equipos'],
                    summary: 'Crea un equipo',
                    security: [{ UserIdHeader: [] }],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/EquipmentInput' }
                            }
                        }
                    },
                    responses: {
                        201: { description: 'Equipo creado' },
                        409: { description: 'Clave duplicada' }
                    }
                }
            },
            '/api/equipment/{id}': {
                put: {
                    tags: ['Equipos'],
                    summary: 'Actualiza un equipo',
                    security: [{ UserIdHeader: [] }],
                    parameters: [
                        {
                            name: 'id',
                            in: 'path',
                            required: true,
                            schema: { type: 'integer' }
                        }
                    ],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/EquipmentInput' }
                            }
                        }
                    },
                    responses: {
                        200: { description: 'Equipo actualizado' },
                        404: { description: 'Equipo no encontrado' }
                    }
                },
                delete: {
                    tags: ['Equipos'],
                    summary: 'Elimina un equipo',
                    security: [{ UserIdHeader: [] }],
                    parameters: [
                        {
                            name: 'id',
                            in: 'path',
                            required: true,
                            schema: { type: 'integer' }
                        }
                    ],
                    responses: {
                        200: {
                            description: 'Equipo eliminado',
                            content: {
                                'application/json': {
                                    schema: { $ref: '#/components/schemas/SuccessResponse' }
                                }
                            }
                        },
                        404: { description: 'Equipo no encontrado' }
                    }
                }
            },
            '/api/motors': {
                get: {
                    tags: ['Equipos'],
                    summary: 'Alias de /api/equipment',
                    security: [{ UserIdHeader: [] }],
                    responses: {
                        200: {
                            description: 'Listado de equipos',
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'array',
                                        items: { $ref: '#/components/schemas/Equipment' }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            '/api/daily-readings': {
                get: {
                    tags: ['Inspecciones'],
                    summary: 'Consulta registros diarios',
                    security: [{ UserIdHeader: [] }],
                    parameters: [
                        { name: 'critical', in: 'query', schema: { type: 'string', enum: ['0', '1'] } },
                        { name: 'date', in: 'query', schema: { type: 'string', example: '2026-05-21' } },
                        { name: 'area', in: 'query', schema: { type: 'string', example: 'Central de pastas' } }
                    ],
                    responses: {
                        200: {
                            description: 'Listado de registros',
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'array',
                                        items: { $ref: '#/components/schemas/Report' }
                                    }
                                }
                            }
                        }
                    }
                },
                post: {
                    tags: ['Inspecciones'],
                    summary: 'Crea o actualiza una lectura diaria',
                    security: [{ UserIdHeader: [] }],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/InspectionInput' }
                            }
                        }
                    },
                    responses: {
                        200: {
                            description: 'Registro guardado o actualizado',
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'object',
                                        properties: {
                                            success: { type: 'boolean', example: true },
                                            updated: { type: 'boolean', example: false }
                                        }
                                    }
                                }
                            }
                        },
                        400: { description: 'Datos incompletos' }
                    }
                }
            },
            '/api/inspection': {
                post: {
                    tags: ['Inspecciones'],
                    summary: 'Alias de /api/daily-readings',
                    security: [{ UserIdHeader: [] }],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/InspectionInput' }
                            }
                        }
                    },
                    responses: {
                        200: { description: 'Registro guardado o actualizado' }
                    }
                }
            },
            '/api/follow-up-reports': {
                get: {
                    tags: ['Reportes'],
                    summary: 'Lista reportes abiertos que requieren seguimiento',
                    security: [{ UserIdHeader: [] }],
                    parameters: [
                        { name: 'area', in: 'query', schema: { type: 'string', example: 'Central de pastas' } }
                    ],
                    responses: {
                        200: {
                            description: 'Listado de hallazgos abiertos',
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'array',
                                        items: { $ref: '#/components/schemas/Report' }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            '/api/dashboard-summary': {
                get: {
                    tags: ['Dashboard'],
                    summary: 'Obtiene el resumen operativo del inicio',
                    security: [{ UserIdHeader: [] }],
                    responses: {
                        200: {
                            description: 'Resumen del dashboard',
                            content: {
                                'application/json': {
                                    schema: { $ref: '#/components/schemas/DashboardSummary' }
                                }
                            }
                        }
                    }
                }
            },
            '/api/reports': {
                get: {
                    tags: ['Reportes'],
                    summary: 'Lista reportes creados',
                    security: [{ UserIdHeader: [] }],
                    parameters: [
                        { name: 'area', in: 'query', schema: { type: 'string', example: 'Central de pastas' } },
                        { name: 'date', in: 'query', schema: { type: 'string', example: '2026-05-21' } },
                        {
                            name: 'finding',
                            in: 'query',
                            schema: {
                                type: 'string',
                                enum: ['vibration', 'noise', 'cleaning', 'comments', 'overloaded']
                            }
                        }
                    ],
                    responses: {
                        200: {
                            description: 'Listado de reportes',
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'array',
                                        items: { $ref: '#/components/schemas/Report' }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            '/api/reports/{id}/close': {
                patch: {
                    tags: ['Reportes'],
                    summary: 'Cierra un hallazgo y registra la accion tomada',
                    security: [{ UserIdHeader: [] }],
                    parameters: [
                        {
                            name: 'id',
                            in: 'path',
                            required: true,
                            schema: { type: 'integer' }
                        }
                    ],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ReportCloseInput' }
                            }
                        }
                    },
                    responses: {
                        200: {
                            description: 'Hallazgo cerrado',
                            content: {
                                'application/json': {
                                    schema: { $ref: '#/components/schemas/SuccessResponse' }
                                }
                            }
                        },
                        404: { description: 'Reporte no encontrado' }
                    }
                }
            }
        }
    },
    apis: []
});
