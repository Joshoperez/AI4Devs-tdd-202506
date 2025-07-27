import { Request, Response } from 'express';
import { addCandidateController } from '../presentation/controllers/candidateController';
import { addCandidate } from '../application/services/candidateService';
import { validateCandidateData } from '../application/validator';
import { Candidate } from '../domain/models/Candidate';

// Mock de Prisma Client
jest.mock('@prisma/client', () => ({
    PrismaClient: jest.fn().mockImplementation(() => ({
        candidate: {
            create: jest.fn(),
            update: jest.fn(),
            findUnique: jest.fn()
        }
    })),
    Prisma: {
        PrismaClientInitializationError: class extends Error {
            constructor() {
                super('Database connection error');
                this.name = 'PrismaClientInitializationError';
            }
        }
    }
}));

// Mock de los modelos
jest.mock('../domain/models/Candidate', () => ({
    Candidate: jest.fn().mockImplementation((data) => ({
        id: data.id,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        address: data.address,
        education: data.education || [],
        workExperience: data.workExperience || [],
        resumes: data.resumes || [],
        save: jest.fn()
    }))
}));
jest.mock('../domain/models/Education');
jest.mock('../domain/models/WorkExperience');
jest.mock('../domain/models/Resume');

describe('Candidate Insertion Tests - JDP', () => {
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;
    let mockJson: jest.Mock;
    let mockStatus: jest.Mock;

    beforeEach(() => {
        mockJson = jest.fn();
        mockStatus = jest.fn().mockReturnValue({ json: mockJson });
        
        mockRequest = {
            body: {}
        };
        
        mockResponse = {
            status: mockStatus,
            json: mockJson
        };

        // Limpiar todos los mocks antes de cada test
        jest.clearAllMocks();
    });

    describe('1. Recepción de datos del formulario', () => {
        
        test('should validate candidate data with valid information', () => {
            // Arrange
            const validCandidateData = {
                firstName: 'Juan',
                lastName: 'Pérez',
                email: 'juan.perez@email.com',
                phone: '612345678',
                address: 'Calle Mayor 123'
            };

            // Act & Assert
            expect(() => validateCandidateData(validCandidateData)).not.toThrow();
        });

        test('should reject candidate data with invalid email format', () => {
            // Arrange
            const invalidCandidateData = {
                firstName: 'Juan',
                lastName: 'Pérez',
                email: 'invalid-email-format',
                phone: '612345678'
            };

            // Act & Assert
            expect(() => validateCandidateData(invalidCandidateData)).toThrow('Invalid email');
        });

        test('should reject candidate data with invalid phone format', () => {
            // Arrange
            const invalidCandidateData = {
                firstName: 'Juan',
                lastName: 'Pérez',
                email: 'juan.perez@email.com',
                phone: '123456789' // Formato inválido (debe empezar con 6, 7 o 9)
            };

            // Act & Assert
            expect(() => validateCandidateData(invalidCandidateData)).toThrow('Invalid phone');
        });

        test('should validate candidate data with education information', () => {
            // Arrange
            const candidateWithEducation = {
                firstName: 'María',
                lastName: 'García',
                email: 'maria.garcia@email.com',
                educations: [
                    {
                        institution: 'Universidad Complutense',
                        title: 'Ingeniería Informática',
                        startDate: '2018-09-01',
                        endDate: '2022-06-30'
                    }
                ]
            };

            // Act & Assert
            expect(() => validateCandidateData(candidateWithEducation)).not.toThrow();
        });

        test('should validate candidate data with work experience', () => {
            // Arrange
            const candidateWithExperience = {
                firstName: 'Carlos',
                lastName: 'López',
                email: 'carlos.lopez@email.com',
                workExperiences: [
                    {
                        company: 'TechCorp',
                        position: 'Desarrollador Senior',
                        description: 'Desarrollo de aplicaciones web',
                        startDate: '2020-01-15',
                        endDate: '2023-12-31'
                    }
                ]
            };

            // Act & Assert
            expect(() => validateCandidateData(candidateWithExperience)).not.toThrow();
        });
    });

    describe('2. Guardado en base de datos', () => {
        
        test('should successfully save candidate to database', async () => {
            // Arrange
            const candidateData = {
                firstName: 'Ana',
                lastName: 'Martínez',
                email: 'ana.martinez@email.com'
            };

            const mockSavedCandidate = {
                id: 1,
                ...candidateData,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            // Mock del método save del modelo Candidate
            const mockSave = jest.fn().mockResolvedValue(mockSavedCandidate);
            (Candidate as jest.MockedClass<typeof Candidate>).mockImplementation((data) => ({
                ...data,
                education: [],
                workExperience: [],
                resumes: [],
                save: mockSave
            }));

            // Act
            const result = await addCandidate(candidateData);

            // Assert
            expect(result).toEqual(mockSavedCandidate);
            expect(mockSave).toHaveBeenCalledTimes(1);
        });

        test('should handle database connection errors', async () => {
            // Arrange
            const candidateData = {
                firstName: 'Pedro',
                lastName: 'Sánchez',
                email: 'pedro.sanchez@email.com'
            };

            // Mock del error de conexión a base de datos
            const mockSave = jest.fn().mockRejectedValue(
                new Error('No se pudo conectar con la base de datos. Por favor, asegúrese de que el servidor de base de datos esté en ejecución.')
            );
            (Candidate as jest.MockedClass<typeof Candidate>).mockImplementation((data) => ({
                ...data,
                education: [],
                workExperience: [],
                resumes: [],
                save: mockSave
            }));

            // Act & Assert
            await expect(addCandidate(candidateData)).rejects.toThrow(
                'No se pudo conectar con la base de datos. Por favor, asegúrese de que el servidor de base de datos esté en ejecución.'
            );
        });

        test('should handle duplicate email errors', async () => {
            // Arrange
            const candidateData = {
                firstName: 'Laura',
                lastName: 'Fernández',
                email: 'laura.fernandez@email.com'
            };

            // Mock del error de email duplicado
            const mockSave = jest.fn().mockRejectedValue({
                code: 'P2002',
                message: 'Unique constraint failed on the fields: (`email`)'
            });
            (Candidate as jest.MockedClass<typeof Candidate>).mockImplementation((data) => ({
                ...data,
                education: [],
                workExperience: [],
                resumes: [],
                save: mockSave
            }));

            // Act & Assert
            await expect(addCandidate(candidateData)).rejects.toThrow(
                'The email already exists in the database'
            );
        });

        test('should handle validation errors in service layer', async () => {
            // Arrange
            const invalidCandidateData = {
                firstName: '', // Nombre vacío
                lastName: 'Gómez',
                email: 'invalid-email'
            };

            // Act & Assert
            await expect(addCandidate(invalidCandidateData)).rejects.toThrow('Invalid name');
        });

        test('should handle controller errors and return appropriate response', async () => {
            // Arrange
            const invalidCandidateData = {
                firstName: '',
                lastName: 'Hernández',
                email: 'invalid-email'
            };

            mockRequest.body = invalidCandidateData;

            // Act
            await addCandidateController(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(mockStatus).toHaveBeenCalledWith(400);
            expect(mockJson).toHaveBeenCalledWith({
                message: 'Error adding candidate',
                error: 'Error: Invalid name'
            });
        });
    });

    describe('3. Tests de integración entre capas', () => {
        
        test('should process complete candidate data through all layers', async () => {
            // Arrange
            const completeCandidateData = {
                firstName: 'Roberto',
                lastName: 'Díaz',
                email: 'roberto.diaz@email.com',
                phone: '712345678',
                address: 'Avenida Principal 456',
                educations: [
                    {
                        institution: 'Universidad Politécnica',
                        title: 'Ingeniería de Software',
                        startDate: '2019-09-01',
                        endDate: '2023-06-30'
                    }
                ],
                workExperiences: [
                    {
                        company: 'InnovationTech',
                        position: 'Full Stack Developer',
                        description: 'Desarrollo de aplicaciones web y móviles',
                        startDate: '2021-03-01',
                        endDate: '2024-01-31'
                    }
                ],
                cv: {
                    filePath: '/uploads/cv-roberto-diaz.pdf',
                    fileType: 'application/pdf'
                }
            };

            const mockSavedCandidate = {
                id: 2,
                firstName: completeCandidateData.firstName,
                lastName: completeCandidateData.lastName,
                email: completeCandidateData.email,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            // Mock del método save
            const mockSave = jest.fn().mockResolvedValue(mockSavedCandidate);
            (Candidate as jest.MockedClass<typeof Candidate>).mockImplementation((data) => ({
                ...data,
                education: [],
                workExperience: [],
                resumes: [],
                save: mockSave
            }));

            // Act
            const result = await addCandidate(completeCandidateData);

            // Assert
            expect(result).toEqual(mockSavedCandidate);
            expect(() => validateCandidateData(completeCandidateData)).not.toThrow();
        });
    });
}); 