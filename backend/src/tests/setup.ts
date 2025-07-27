// Configuración global para Jest

// Configurar el entorno de pruebas
process.env.NODE_ENV = 'test';

// Configurar timeouts globales
jest.setTimeout(10000);

// Configurar mocks globales si es necesario
global.console = {
    ...console,
    // Silenciar logs durante las pruebas
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
}; 