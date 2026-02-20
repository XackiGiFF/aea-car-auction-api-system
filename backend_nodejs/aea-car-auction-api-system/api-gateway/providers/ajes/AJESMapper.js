const axios = require('axios');

class AJESMapper {
    constructor() {
        // ==================== ТИПЫ ТОПЛИВА ====================
        this.fuelTypes = [
            { code: 'P', name: 'Бензин', tks_type: 'petrol', groups: ['petrol'] },
            { code: 'G', name: 'Бензин', tks_type: 'petrol', groups: ['petrol'] },
            { code: 'D', name: 'Дизель', tks_type: 'diesel', groups: ['diesel'] },
            { code: 'H', name: 'Гибрид', tks_type: 'petrol_electric', groups: ['hybrid', 'petrol_electric'] },
            { code: 'HE', name: 'Подзаряжаемый гибрид', tks_type: 'petrol_electric', groups: ['hybrid', 'petrol_electric', 'plugin'] },
            { code: 'E', name: 'Электрический', tks_type: 'electric', groups: ['electric'] },
            { code: 'L', name: 'Газ (LPG)', tks_type: 'gas', groups: ['gas'] },
            { code: 'C', name: 'Газ метан (CNG)', tks_type: 'gas', groups: ['gas'] },
            { code: 'O', name: 'Другое', tks_type: 'other', groups: ['other'] },
            { code: '&', name: 'Гибрид дизель-электрический', tks_type: 'diesel_electric', groups: ['hybrid', 'diesel_electric'] },
            { code: '', name: 'Не указано', tks_type: 'other', groups: ['unknown'] }
        ];

        // Группы типов топлива для фильтрации
        this.fuelGroups = {
            petrol: {
                name: 'Бензин',
                codes: ['P', 'G', ],
                search_codes: ['P', 'G']
            },
            gas: {
                name: 'Газ',
                codes: ['L', 'C'],
                search_codes: ['L', 'C']
            },
            diesel: {
                name: 'Дизель',
                codes: ['D'],
                search_codes: ['D']
            },
            hybrid: {
                name: 'Гибрид',
                codes: ['H', 'HE', '&'],
                search_codes: ['H', 'HE', '&']
            },
            electric: {
                name: 'Электрический',
                codes: ['E'],
                search_codes: ['E']
            },
            other: {
                name: 'Другое',
                codes: ['O', ''],
                search_codes: ['O', '']
            }
        };

        // ==================== ПРИВОДЫ ====================
        // Маппинг кодов приводов на стандартные группы
        this.driveMapping = {
            // Передний привод
            'FF': 'fwd',
            'FWD': 'fwd',
            'FF,FULLTIME4WD': 'awd',
            'FF,PARTTIME4WD': 'awd',

            // Задний привод
            'FR': 'rwd',
            'RWD': 'rwd',
            'RR': 'rwd',
            'FR,FULLTIME4WD': 'awd',
            'FR,PARTTIME4WD': 'awd',
            'FR,FULLTIME4WD,PARTT': 'awd',
            'MIDSHIP': 'rwd',
            'FULLTIME4WD,MIDSHIP': 'awd',
            'Mid-engine RWD': 'rwd',

            // Полный привод
            '4WD': 'awd',
            'AWD': 'awd',
            'FULLTIME4WD': 'awd',
            'PARTTIME4WD': 'awd',
            'FULLTIME4WD,PARTTIME': 'awd',
            'On-demand AWD': 'awd',
            'Full-time 4WD': 'awd',
            'Electric 4WD': 'awd',

            // Другие
            '-': 'other',
            '': 'unknown'
        };

        // Группы приводов для фильтрации
        this.driveGroups = {
            fwd: {
                name: 'Передний привод',
                codes: ['FF', 'FWD'],
                search_codes: ['FF', 'FWD']
            },
            rwd: {
                name: 'Задний привод',
                codes: ['FR', 'RWD', 'RR', 'MIDSHIP'],
                search_codes: ['FR', 'RWD', 'RR', 'MIDSHIP']
            },
            awd: {
                name: 'Полный привод',
                codes: ['4WD', 'AWD', 'FULLTIME4WD', 'PARTTIME4WD', 'On-demand AWD', 'Full-time 4WD', 'Electric 4WD'],
                search_codes: ['4WD', 'AWD', 'FULLTIME4WD', 'PARTTIME4WD']
            },
            other: {
                name: 'Другое',
                codes: ['-'],
                search_codes: ['-']
            },
            unknown: {
                name: 'Не указано',
                codes: [''],
                search_codes: ['']
            }
        };

        // ==================== ТРАНСМИССИИ ====================
        // Маппинг кодов трансмиссий на стандартные группы
        this.transmissionMapping = {
            // Автоматические
            'AT': 'automatic',
            'A': 'automatic',
            'Auto': 'automatic',
            'FAT': 'automatic',
            'SAT': 'automatic',
            'DAT': 'automatic',
            'IAT': 'automatic',
            'FA': 'automatic',
            'IA': 'automatic',
            'DA': 'automatic',
            '4AT': 'automatic',
            '5AT': 'automatic',
            '6AT': 'automatic',
            '7AT': 'automatic',
            '8AT': 'automatic',
            '9AT': 'automatic',
            'F': 'automatic',
            'FM': 'automatic',
            'F4': 'automatic',
            'F5': 'automatic',
            'F6': 'automatic',
            'F7': 'automatic',
            'I5': 'automatic',
            'I6': 'automatic',
            '5F': 'automatic',
            '6F': 'automatic',
            '4F': 'automatic',
            '5D': 'automatic',
            '6D': 'automatic',
            'DCT': 'automatic',
            'DSG': 'automatic',
            'PDK': 'automatic',
            'SEMIAT': 'automatic',
            '&#65401;&#65438;&#65437;&#65404;': 'automatic',
            '&#65412;&#65400;S': 'automatic',

            // Механические
            'MT': 'manual',
            'M': 'manual',
            '5MT': 'manual',
            '6MT': 'manual',
            '7MT': 'manual',
            '4MT': 'manual',
            'FMT': 'manual',
            'DMT': 'manual',
            '5DMT': 'manual',
            '6FMT': 'manual',
            '5FMT': 'manual',
            'IMT': 'manual',
            'M5': 'manual',
            '&#65407;&#65417;&#65408;': 'manual',

            // Вариаторы
            'CVT': 'cvt',
            'C': 'cvt',
            'CA': 'cvt',
            'CAT': 'cvt',
            'C3': 'cvt',
            'C5': 'cvt',
            'C6': 'cvt',
            '5C': 'cvt',
            '&#65412;&#65400;&#65404;&#65389;': 'cvt',

            // Гибридные
            'HL': 'hybrid',
            'HL5': 'hybrid',
            'HL6': 'hybrid',
            'HL8': 'hybrid',
            'HL9': 'hybrid',
            'H': 'hybrid',

            // Последовательные
            'SQ': 'sequential',
            'SEQ': 'sequential',
            '5ｿｸ': 'sequential',
            '4ｿｸ': 'sequential',

            // Другие
            '-': 'other',
            '...': 'other',
            '..S': 'other',
            '6': 'other',
            '5': 'other',
            '8X2': 'other',
            '特殊ｼﾌ': 'other',
            'ﾄｸS': 'other',
            'ｿﾉﾀ': 'other',
            'その他': 'other',
            '&#12381;&#12398;&#20182;': 'other',
            '기타': 'other',
            '': 'unknown'
        };

        // Группы трансмиссий для фильтрации
        this.transmissionGroups = {
            automatic: {
                name: 'Автоматическая',
                codes: ['AT', 'A', 'Auto', 'FAT', 'SAT', 'DAT', 'IAT', 'FA', 'IA', 'DA', '4AT', '5AT', '6AT', '7AT', '8AT', '9AT', 'F', 'FM', 'F4', 'F5', 'F6', 'F7', 'I5', 'I6', '5F', '6F', '4F', '5D', '6D', 'DCT', 'DSG', 'PDK', 'SEMIAT'],
                search_codes: ['AT', 'A', 'Auto', 'FAT', 'SAT', 'DAT', 'IAT', 'FA', 'IA', 'DA', '4AT', '5AT', '6AT', '7AT', '8AT', '9AT', 'F', 'FM', 'F4', 'F5', 'F6', 'F7', 'I5', 'I6', '5F', '6F', '4F', '5D', '6D', 'DCT', 'DSG', 'PDK', 'SEMIAT']
            },
            manual: {
                name: 'Механическая',
                codes: ['MT', 'M', '5MT', '6MT', '7MT', '4MT', 'FMT', 'DMT', '5DMT', '6FMT', '5FMT', 'IMT', 'M5'],
                search_codes: ['MT', 'M', '5MT', '6MT', '7MT', '4MT', 'FMT', 'DMT', '5DMT', '6FMT', '5FMT', 'IMT', 'M5']
            },
            cvt: {
                name: 'Вариатор (CVT)',
                codes: ['CVT', 'C', 'CA', 'CAT', 'C3', 'C5', 'C6', '5C'],
                search_codes: ['CVT', 'C', 'CA', 'CAT', 'C3', 'C5', 'C6', '5C']
            },
            hybrid: {
                name: 'Гибридная',
                codes: ['HL', 'HL5', 'HL6', 'HL8', 'HL9', 'H'],
                search_codes: ['HL', 'HL5', 'HL6', 'HL8', 'HL9', 'H']
            },
            sequential: {
                name: 'Последовательная',
                codes: ['SQ', 'SEQ', '5ｿｸ', '4ｿｸ'],
                search_codes: ['SQ', 'SEQ']
            },
            other: {
                name: 'Другое',
                codes: ['-', '...', '..S', '6', '5', '8X2', '特殊ｼﾌ', 'ﾄｸS', 'ｿﾉﾀ', 'その他', '기타'],
                search_codes: ['-', '...', '..S', '6', '5', '8X2', '特殊ｼﾌ', 'ﾄｸS', 'ｿﾉﾀ', 'その他', '기타']
            },
            unknown: {
                name: 'Не указано',
                codes: [''],
                search_codes: ['']
            }
        };
    }

    // ==================== ОСНОВНЫЕ МЕТОДЫ ====================

    /**
     * Преобразовать код трансмиссии
     */
    mapTransmission(code) {
        if (!code) return '';
        const upperCode = code.toUpperCase();

        // Сначала проверяем точное совпадение
        if (this.transmissionMapping[upperCode] !== undefined) {
            return code;
        }

        // Проверяем по подстроке
        if (upperCode.includes('AT') || upperCode.includes('AUTO')) {
            return 'AT';
        }
        if (upperCode.includes('MT') || upperCode.includes('MANUAL')) {
            return 'MT';
        }
        if (upperCode.includes('CVT')) {
            return 'CVT';
        }
        if (upperCode.includes('HYBRID') || upperCode.includes('HL')) {
            return 'HL';
        }
        if (upperCode.includes('SEQ') || upperCode.includes('SQ') || upperCode.includes('ｿｸ')) {
            return 'SQ';
        }

        return code;
    }

    /**
     * Преобразовать код привода
     */
    mapDrive(code) {
        if (!code) return '';
        const upperCode = code.toUpperCase();

        // Сначала проверяем точное совпадение
        if (this.driveMapping[code] !== undefined) {
            return code;
        }

        // Проверяем по подстроке
        if (upperCode.includes('FF') || upperCode.includes('FWD')) {
            return 'FF';
        }
        if (upperCode.includes('FR') || upperCode.includes('RWD') || upperCode.includes('RR') || upperCode.includes('MIDSHIP')) {
            return 'FR';
        }
        if (upperCode.includes('4WD') || upperCode.includes('AWD') || upperCode.includes('FULLTIME') || upperCode.includes('PARTTIME')) {
            return '4WD';
        }

        return code;
    }

    /**
     * Получить группу трансмиссии
     */
    getTransmissionGroup(code) {
        if (!code) return 'unknown';
        const mappedCode = this.mapTransmission(code);
        const upperCode = mappedCode.toUpperCase();
        return this.transmissionMapping[upperCode] || 'other';
    }

    /**
     * Получить группу привода
     */
    getDriveGroup(code) {
        if (!code) return 'unknown';
        return this.driveMapping[code] || 'other';
    }

    /**
     * Получить информацию о типе топлива
     */
    getFuelInfo(code) {
        return this.fuelTypes.find(f => f.code === code) ||
            this.fuelTypes.find(f => f.code === '') ||
            { code: '', name: 'Не указано', tks_type: 'petrol', groups: ['unknown'] };
    }

    /**
     * Получить коды для поиска по группе
     */
    getSearchCodesForGroup(type, group) {
        switch(type) {
            case 'transmission':
                return this.transmissionGroups[group]?.search_codes || [];
            case 'drive':
                return this.driveGroups[group]?.search_codes || [];
            case 'fuel':
                return this.fuelGroups[group]?.search_codes || [];
            default:
                return [];
        }
    }

    /**
     * Получить название трансмиссии
     */
    getTransmissionName(code) {
        const names = {
            'AT': 'Автоматическая',
            'MT': 'Механическая',
            'CVT': 'Вариатор',
            'HL': 'Гибридная',
            'SQ': 'Последовательная',
            'FAT': 'Автоматическая (F)',
            'SAT': 'Автоматическая (S)',
            'DAT': 'Автоматическая (D)',
            'IAT': 'Автоматическая (I)',
            '5MT': '5-ступ. механика',
            '6MT': '6-ступ. механика',
            '4AT': '4-ступ. автомат',
            '5AT': '5-ступ. автомат',
            '6AT': '6-ступ. автомат',
            '7AT': '7-ступ. автомат',
            '8AT': '8-ступ. автомат',
            '9AT': '9-ступ. автомат',
            'DCT': 'Робот (DCT)',
            'DSG': 'Робот (DSG)',
            'PDK': 'Робот (PDK)',
            'SEMIAT': 'Полуавтомат',
            'Auto': 'Автоматическая',
            'M': 'Механическая',
            'C': 'Вариатор',
            'H': 'Гибридная',
            'SEQ': 'Последовательная',
            'F': 'Автоматическая',
            'FM': 'Автоматическая',
            'FA': 'Автоматическая',
            'IA': 'Автоматическая',
            'DA': 'Автоматическая'
        };

        return names[code] || code;
    }

    /**
     * Получить название привода
     */
    getDriveName(code) {
        const names = {
            'FF': 'Передний привод',
            'FWD': 'Передний привод',
            'FR': 'Задний привод',
            'RWD': 'Задний привод',
            'RR': 'Задний привод',
            '4WD': 'Полный привод',
            'AWD': 'Полный привод',
            'FULLTIME4WD': 'Постоянный полный',
            'PARTTIME4WD': 'Подключаемый полный',
            'MIDSHIP': 'Среднемоторный',
            'On-demand AWD': 'Подключаемый полный',
            'Full-time 4WD': 'Постоянный полный',
            'Electric 4WD': 'Электрический полный',
            'FF,FULLTIME4WD': 'Передний/Полный',
            'FR,FULLTIME4WD': 'Задний/Полный',
            'FR,PARTTIME4WD': 'Задний/Подкл. полный',
            'FULLTIME4WD,PARTTIME': 'Постоянный/Подкл. полный',
            'FR,FULLTIME4WD,PARTT': 'Задний/Полный/Подкл.',
            'FULLTIME4WD,MIDSHIP': 'Полный/Среднемоторный',
            'Mid-engine RWD': 'Среднемоторный задний'
        };

        return names[code] || code;
    }

    /**
     * Преобразовать данные автомобиля
     */
    mapCarData(carData) {
        if (!carData) return carData;

        const mappedCar = { ...carData };

        // Преобразуем трансмиссию
        if (carData.KPP) {
            mappedCar.KPP = this.mapTransmission(carData.KPP);
            mappedCar.transmission_group = this.getTransmissionGroup(mappedCar.KPP);
            mappedCar.transmission_name = this.getTransmissionName(mappedCar.KPP);
        }

        // Преобразуем привод
        if (carData.PRIV) {
            mappedCar.PRIV = this.mapDrive(carData.PRIV);
            mappedCar.drive_group = this.getDriveGroup(mappedCar.PRIV);
            mappedCar.drive_name = this.getDriveName(mappedCar.PRIV);
        }

        // Преобразуем тип топлива
        if (carData.TIME !== undefined) {
            const fuelInfo = this.getFuelInfo(carData.TIME);
            mappedCar.fuel_name = fuelInfo.name;
            mappedCar.tks_type = fuelInfo.tks_type;
            mappedCar.fuel_groups = fuelInfo.groups;
        }

        return mappedCar;
    }

    /**
     * Обработать данные о типах топлива
     */
    processFuelData(data, fuelColumn) {
        const codeStats = {};
        data.forEach(row => {
            const code = row[fuelColumn] || row.TIME || '';
            const count = parseInt(row.TAG1 || row.count || 0);
            codeStats[code] = count;
        });

        const groupStats = {};
        Object.entries(this.fuelGroups).forEach(([groupKey, group]) => {
            groupStats[groupKey] = {
                name: group.name,
                count: 0,
                codes: []
            };

            group.codes.forEach(code => {
                if (codeStats[code] !== undefined) {
                    groupStats[groupKey].count += codeStats[code];
                    groupStats[groupKey].codes.push({
                        code: code,
                        name: this.getFuelInfo(code).name,
                        count: codeStats[code]
                    });
                }
            });
        });

        return groupStats;
    }

    /**
     * Обработать данные о трансмиссиях
     */
    processTransmissionData(data, transmissionColumn) {
        const codeStats = {};
        data.forEach(row => {
            const code = row[transmissionColumn] || row.KPP || '';
            const count = parseInt(row.TAG1 || row.count || 0);
            codeStats[code] = count;
        });

        const groupStats = {};
        Object.entries(this.transmissionGroups).forEach(([groupKey, group]) => {
            groupStats[groupKey] = {
                name: group.name,
                count: 0,
                codes: []
            };

            group.codes.forEach(code => {
                if (codeStats[code] !== undefined) {
                    groupStats[groupKey].count += codeStats[code];
                    groupStats[groupKey].codes.push({
                        code: code,
                        name: this.getTransmissionName(code),
                        count: codeStats[code]
                    });
                }
            });
        });

        return groupStats;
    }

    /**
     * Обработать данные о приводах
     */
    processDriveData(data, driveColumn) {
        const codeStats = {};
        data.forEach(row => {
            const code = row[driveColumn] || row.PRIV || '';
            const count = parseInt(row.TAG1 || row.count || 0);
            codeStats[code] = count;
        });

        const groupStats = {};
        Object.entries(this.driveGroups).forEach(([groupKey, group]) => {
            groupStats[groupKey] = {
                name: group.name,
                count: 0,
                codes: []
            };

            group.codes.forEach(code => {
                if (codeStats[code] !== undefined) {
                    groupStats[groupKey].count += codeStats[code];
                    groupStats[groupKey].codes.push({
                        code: code,
                        name: this.getDriveName(code),
                        count: codeStats[code]
                    });
                }
            });
        });

        return groupStats;
    }

    /**
     * Получить пустые группы топлива
     */
    getEmptyFuelGroups() {
        const groups = {};
        Object.entries(this.fuelGroups).forEach(([key, group]) => {
            groups[key] = {
                name: group.name,
                count: 0,
                codes: []
            };
        });
        return groups;
    }

    /**
     * Получить пустые группы трансмиссий
     */
    getEmptyTransmissionGroups() {
        const groups = {};
        Object.entries(this.transmissionGroups).forEach(([key, group]) => {
            groups[key] = {
                name: group.name,
                count: 0,
                codes: []
            };
        });
        return groups;
    }

    /**
     * Получить пустые группы приводов
     */
    getEmptyDriveGroups() {
        const groups = {};
        Object.entries(this.driveGroups).forEach(([key, group]) => {
            groups[key] = {
                name: group.name,
                count: 0,
                codes: []
            };
        });
        return groups;
    }
}

module.exports = new AJESMapper();