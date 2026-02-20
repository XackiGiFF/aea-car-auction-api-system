/**
 * Test Dynamic Filters - Тестирование динамических фильтров
 */

window.testDynamicFilters = function() {
    console.log('🔄 ТЕСТ ДИНАМИЧЕСКИХ ФИЛЬТРОВ');
    
    if (!window.carSearch) {
        console.error('❌ CarSearchUnified не инициализирован');
        return;
    }
    
    try {
        console.log('📋 Текущие фильтры:');
        var filters = window.carSearch.collectCurrentFilters();
        console.log(filters);
        
        console.log('🔄 Запуск загрузки динамических фильтров...');
        window.carSearch.loadDynamicFilters();
        
        console.log('ℹ️ Проверьте сетевые запросы в вкладке Network для анализа AJAX запросов');
        
    } catch (e) {
        console.error('❌ Ошибка при тестировании динамических фильтров:', e.message);
    }
};

// Добавляем функцию в глобальные функции отладки при загрузке
jQuery(document).ready(function() {
    setTimeout(function() {
        if (typeof window.testDynamicFilters === 'function') {
            console.log('🆕 Новая функция отладки добавлена: testDynamicFilters()');
        }
    }, 2500);
});
