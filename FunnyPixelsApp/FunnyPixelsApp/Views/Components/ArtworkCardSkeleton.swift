import Combine
import SwiftUI

struct ArtworkCardSkeleton: View {
    @State private var isAnimating = false
    
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // 缩略图占位
            GeometryReader { geometry in
                ZStack {
                    Color(.systemGray6)
                    
                    // 闪光动画
                    Rectangle()
                        .fill(
                            LinearGradient(
                                gradient: Gradient(colors: [.clear, .white.opacity(0.4), .clear]),
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .frame(width: 200)
                        .offset(x: isAnimating ? geometry.size.width : -geometry.size.width)
                }
            }
            .aspectRatio(4/3, contentMode: .fit)
            .clipped()
            
            // 信息占位
            VStack(alignment: .leading, spacing: 10) {
                // 标题行
                RoundedRectangle(cornerRadius: 4)
                    .fill(Color(.systemGray5))
                    .frame(height: 16)
                    .frame(maxWidth: .infinity)
                
                // 数据行
                HStack(spacing: 8) {
                    ForEach(0..<2) { _ in
                        RoundedRectangle(cornerRadius: 3)
                            .fill(Color(.systemGray6))
                            .frame(width: 40, height: 12)
                    }
                    Spacer()
                }
            }
            .padding(12)
        }
        .background(Color(.systemBackground))
        .cornerRadius(16)
        .shadow(color: Color.black.opacity(0.04), radius: 4, x: 0, y: 2)
        .onAppear {
            withAnimation(
                .linear(duration: 1.5)
                .repeatForever(autoreverses: false)
            ) {
                isAnimating = true
            }
        }
    }
}

#Preview {
    ZStack {
        Color(.systemGroupedBackground)
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            ArtworkCardSkeleton()
            ArtworkCardSkeleton()
        }
        .padding()
    }
}
