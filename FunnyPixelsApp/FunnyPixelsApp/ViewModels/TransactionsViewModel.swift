import SwiftUI
import Combine

/// 交易记录视图模型
class TransactionsViewModel: ObservableObject {
    @Published var transactions: [ShopService.Transaction] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    
    // Filters
    @Published var selectedType: TransactionType = .all
    @Published var startDate: Date = Date().addingTimeInterval(-30 * 24 * 3600) // Last 30 days
    @Published var endDate: Date = Date()
    
    private let service = ShopService.shared
    
    enum TransactionType: String, CaseIterable, Identifiable {
        case all = "全部"
        case purchase = "购买"
        case use = "使用"
        case refund = "退款"
        
        var id: String { rawValue }
        
        var apiValue: String? {
            switch self {
            case .all: return nil
            case .purchase: return "purchase"
            case .use: return "use"
            case .refund: return "refund"
            }
        }
    }
    
    init() {
        // Initial load
    }
    
    @MainActor
    func loadData() {
        guard !isLoading else { return }
        isLoading = true
        errorMessage = nil
        
        Task {
            do {
                let formatter = DateFormatter()
                formatter.dateFormat = "yyyy-MM-dd"
                
                let startStr = formatter.string(from: startDate)
                let endStr = formatter.string(from: endDate)
                
                let (fetchedTransactions, _) = try await service.getTransactions(
                    page: 1,
                    limit: 50,
                    type: selectedType.apiValue,
                    startDate: startStr,
                    endDate: endStr
                )
                
                self.transactions = fetchedTransactions
            } catch {
                self.errorMessage = "加载交易记录失败: \(error.localizedDescription)"
            }
            self.isLoading = false
        }
    }
}

/// 充值视图模型
class RechargeViewModel: ObservableObject {
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var paymentSession: ShopService.RechargeSessionResponse.RechargeSessionData?
    
    private let service = ShopService.shared
    
    @Published var rechargeOrders: [ShopService.RechargeOrder] = []
    
    @MainActor
    func createRecharge(amount: Double, channel: String) async -> ShopService.RechargeSessionResponse.RechargeSessionData? {
        isLoading = true
        errorMessage = nil
        
        defer { isLoading = false }
        
        do {
            let session = try await service.createRechargeSession(amountRmb: amount, channel: channel)
            self.paymentSession = session
            return session
        } catch {
             self.errorMessage = "充值失败: \(error.localizedDescription)"
             return nil
        }
    }
    
    @MainActor
    func confirmPayment(orderId: String) async -> Bool {
        isLoading = true
        do {
            let success = try await service.confirmPayment(orderId: orderId)
            isLoading = false
            return success
        } catch {
            self.errorMessage = "支付确认失败: \(error.localizedDescription)"
            isLoading = false
            return false
        }
    }
    
    @MainActor
    func loadHistory() async {
        isLoading = true
        do {
            rechargeOrders = try await service.getRechargeOrders()
        } catch {
            Logger.error("Failed to load recharge history: \(error)")
        }
        isLoading = false
    }
}
