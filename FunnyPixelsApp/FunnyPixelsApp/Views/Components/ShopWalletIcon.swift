import SwiftUI

struct ShopWalletIcon: View {
    var size: CGFloat = 24
    var color: Color = Color(red: 1.0, green: 0.84, blue: 0.0) // Gold
    
    var body: some View {
        ZStack {
            // Broken Circle
            Circle()
                .trim(from: 0.0, to: 0.75) // 3/4 circle
                .stroke(style: StrokeStyle(lineWidth: size * 0.1, lineCap: .round))
                .foregroundColor(color)
                .rotationEffect(.degrees(0)) // Rotate to open at top-right
            
            // Yen Symbol
            Text("¥")
                .font(.system(size: size * 0.6, weight: .bold, design: .rounded))
                .foregroundColor(color)
                .offset(y: 1) // Optical center adjustment
            
            // Plus Sign
            Image(systemName: "plus")
                .font(.system(size: size * 0.4, weight: .bold))
                .foregroundColor(color)
                .offset(x: size * 0.4, y: -size * 0.4) // Position at top-right
        }
        .frame(width: size, height: size)
    }
}

#Preview {
    ZStack {
        Color.black
        ShopWalletIcon(size: 48)
    }
}
