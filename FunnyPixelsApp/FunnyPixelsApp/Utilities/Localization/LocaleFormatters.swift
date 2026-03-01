import Foundation

@MainActor
enum LocaleFormatters {
    private static var cachedLocaleIdentifier: String?
    private static var _dateFormatter: DateFormatter?
    private static var _dateTimeFormatter: DateFormatter?
    private static var _numberFormatter: NumberFormatter?
    private static var _currencyFormatter: NumberFormatter?
    private static var _relativeDateFormatter: RelativeDateTimeFormatter?

    private static func invalidateIfNeeded() {
        let current = LocalizationManager.shared.locale.identifier
        if cachedLocaleIdentifier != current {
            cachedLocaleIdentifier = current
            _dateFormatter = nil
            _dateTimeFormatter = nil
            _numberFormatter = nil
            _currencyFormatter = nil
            _relativeDateFormatter = nil
        }
    }

    static var dateFormatter: DateFormatter {
        invalidateIfNeeded()
        if let cached = _dateFormatter { return cached }
        let formatter = DateFormatter()
        formatter.locale = LocalizationManager.shared.locale
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        _dateFormatter = formatter
        return formatter
    }

    static var dateTimeFormatter: DateFormatter {
        invalidateIfNeeded()
        if let cached = _dateTimeFormatter { return cached }
        let formatter = DateFormatter()
        formatter.locale = LocalizationManager.shared.locale
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        _dateTimeFormatter = formatter
        return formatter
    }

    static var numberFormatter: NumberFormatter {
        invalidateIfNeeded()
        if let cached = _numberFormatter { return cached }
        let formatter = NumberFormatter()
        formatter.locale = LocalizationManager.shared.locale
        formatter.numberStyle = .decimal
        _numberFormatter = formatter
        return formatter
    }

    static var currencyFormatter: NumberFormatter {
        invalidateIfNeeded()
        if let cached = _currencyFormatter { return cached }
        let formatter = NumberFormatter()
        formatter.locale = LocalizationManager.shared.locale
        formatter.numberStyle = .currency
        _currencyFormatter = formatter
        return formatter
    }

    static var relativeDateFormatter: RelativeDateTimeFormatter {
        invalidateIfNeeded()
        if let cached = _relativeDateFormatter { return cached }
        let formatter = RelativeDateTimeFormatter()
        formatter.locale = LocalizationManager.shared.locale
        formatter.unitsStyle = .abbreviated
        _relativeDateFormatter = formatter
        return formatter
    }
}
