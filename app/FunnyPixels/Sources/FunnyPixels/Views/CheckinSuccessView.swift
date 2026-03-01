import SwiftUI

struct CheckinSuccessView: View {
    let result: CheckinResult
    @Binding var isPresented: Bool

    @State private var iconScale: CGFloat = 0

    var body: some View {
        VStack(spacing: 16) {
            Capsule()
                .fill(.secondary.opacity(0.3))
                .frame(width: 36, height: 4)

            HStack(spacing: 16) {
                Circle()
                    .fill(Color.blue)
                    .frame(width: 64, height: 64)
                    .overlay {
                        Image(systemName: "checkmark")
                            .font(.system(size: 28, weight: .bold))
                            .foregroundStyle(.white)
                            .scaleEffect(iconScale)
                    }
                    .shadow(color: .blue.opacity(0.3), radius: 8)

                VStack(alignment: .leading, spacing: 6) {
                    Text("签到成功")
                        .font(.headline)
                        .fontWeight(.semibold)

                    Text("连续 \(result.consecutiveDays) 天")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                Spacer()
            }

            GroupBox {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("获得积分")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Text("+\(result.rewardPoints)")
                            .font(.title3)
                            .fontWeight(.semibold)
                            .foregroundStyle(.blue)
                    }

                    Spacer()
                }
            }

            Button {
                withAnimation(.spring()) {
                    isPresented = false
                }
            } label: {
                Text("知道了")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .tint(.blue)
        }
        .padding()
        .background(.regularMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 20))
        .shadow(color: .black.opacity(0.1), radius: 20, y: 10)
        .onAppear {
            withAnimation(.spring(response: 0.5, dampingFraction: 0.6).delay(0.1)) {
                iconScale = 1
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                withAnimation(.spring()) {
                    isPresented = false
                }
            }
        }
    }
}
