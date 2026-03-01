
import SwiftUI

struct RankBadge: View {
    let rank: Int
    
    var body: some View {
        if rank <= 3 {
             Image(systemName: iconName)
                .font(.system(size: 20, weight: .bold))
                .foregroundColor(iconColor)
                .frame(width: 30)
                .shadow(color: iconColor.opacity(0.3), radius: 2, x: 0, y: 1)
        } else {
            Text("\(rank)")
                .font(AppTypography.headline())
                .foregroundColor(AppColors.textSecondary)
                .frame(width: 30)
        }
    }
    
    private var iconName: String {
        switch rank {
        case 1: return "trophy.fill"
        case 2: return "medal.fill"
        case 3: return "medal.fill"
        default: return "number"
        }
    }
    
    private var iconColor: Color {
        switch rank {
        case 1: return AppColors.warning // Gold
        case 2: return Color.gray      // Silver
        case 3: return Color.orange    // Bronze
        default: return AppColors.textSecondary
        }
    }
}
