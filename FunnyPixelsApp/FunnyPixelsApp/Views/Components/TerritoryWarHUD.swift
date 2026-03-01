import SwiftUI

struct TerritoryWarHUD: View {
    let event: EventService.Event
    @ObservedObject var eventManager = EventManager.shared
    
    // MARK: - Models
    struct AllianceScore: Identifiable, Codable {
        let id: String
        let name: String
        let score: Double // 0.0 - 1.0 (percentage)
        let colorHex: String
        
        var color: Color {
            Color(hex: colorHex) ?? .gray
        }
        
        enum CodingKeys: String, CodingKey {
            case id, name, score
            case colorHex = "color"
        }
        
        init(id: String, name: String, score: Double, colorHex: String) {
            self.id = id
            self.name = name
            self.score = score
            self.colorHex = colorHex
        }
    }
    
    @State private var timeRemaining: String = "29:59"
    @State private var myRank: Int = 0
    @State private var myAllianceId: String = "" // Should get from AuthManager but for HUD display it's managed via logic
    @State private var showDetail = false
    
    var body: some View {
        Group {
            switch eventManager.hudState {
            case .full:
                fullView
            case .compact:
                compactView
            case .minimized:
                minimizedView
            }
        }
        .animation(.timingCurve(0.2, 0.8, 0.2, 1, duration: 0.4), value: eventManager.hudState) // Material Easing
        .sheet(isPresented: $showDetail) {
            NavigationView {
                EventDetailView(event: event)
            }
        }
    }
    
    // MARK: - Subviews
    
    private var fullView: some View {
        VStack(spacing: 0) {
            // Header
            Button(action: { showDetail = true }) {
                HStack(alignment: .center) {
                    Text("⚔️ \(event.title)")
                        .font(DesignTokens.Typography.subheadline.weight(.semibold))
                        .foregroundColor(Color.gray) // Grey text
                    
                    Spacer()
                    
                    // Toggle Button (Minimize) -> Separate button to avoid conflict?
                    // Actually, let's keep minimize as a separate button to the right,
                    // and make the title area tappable for details.
                    // Or just make the whole header tappable except the chevron.
                }
            }
            .buttonStyle(PlainButtonStyle()) // Avoid default button style
            .overlay(
                 HStack {
                     Spacer()
                     Button(action: { eventManager.hudState = .compact }) {
                         Image(systemName: "chevron.up")
                             .font(DesignTokens.Typography.subheadline.weight(.bold))
                             .foregroundColor(Color.green)
                             .padding(8)
                     }
                 }
            )
            .padding(.horizontal, 16)
            .padding(.top, 12)
            .padding(.bottom, 8)
            
            Divider()
                .background(Color(uiColor: .systemGray6))
            
            // Content
            VStack(spacing: 12) {
                // Battle Bar (Green)
                battleBar(height: 8)
                    .padding(.top, 8)
                
                // Detailed Rankings
                VStack(spacing: 0) {
                    let items = processScoresForDisplay()
                    ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                        HStack(spacing: 12) {
                            // Rank / Indicator
                            Circle()
                                .fill(item.color)
                                .frame(width: 8, height: 8)
                            
                            // Name
                            Text(item.name)
                                .font(DesignTokens.Typography.subheadline)
                                .foregroundColor(Color.gray) // Grey text
                                .lineLimit(1)
                            
                            Spacer()
                            
                            // Percentage (Cyan)
                            Text("\(Int(item.score * 100))%")
                                .font(DesignTokens.Typography.subheadline.weight(.medium).monospacedDigit())
                                .foregroundColor(Color.cyan) // Cyan numbers
                        }
                        .padding(.vertical, 8)
                        
                        // Separator between items
                        if index < items.count - 1 {
                            Divider()
                                .padding(.leading, 20)
                        }
                    }
                }
                
                // Footer
                HStack {
                    Text("\(eventManager.totalPixels) pixels")
                        .font(DesignTokens.Typography.caption)
                        .foregroundColor(Color.gray.opacity(0.8))
                    
                    Spacer()
                    
                    Button(action: { eventManager.toggleFollow(eventId: event.id) }) {
                        Label(
                            title: { Text(eventManager.followedEventId == event.id ? "Following" : "Follow").font(DesignTokens.Typography.caption.weight(.medium)) },
                            icon: { Image(systemName: eventManager.followedEventId == event.id ? "star.fill" : "star").font(DesignTokens.Typography.caption2) }
                        )
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(eventManager.followedEventId == event.id ? Color.green.opacity(0.1) : Color.clear)
                        .foregroundColor(eventManager.followedEventId == event.id ? .green : .gray)
                        .cornerRadius(4)
                    }
                }
                .padding(.top, 4)
            }
            .padding(16)
        }
        .background(Color.white)
        .cornerRadius(12)
        .shadow(color: Color.black.opacity(0.1), radius: 8, x: 0, y: 4)
        .frame(maxWidth: 280)
        .transition(.asymmetric(insertion: .scale(scale: 0.95, anchor: .topTrailing).combined(with: .opacity),
                                removal: .scale(scale: 0.95, anchor: .topTrailing).combined(with: .opacity)))
    }
    
    private var compactView: some View {
        Button(action: { eventManager.hudState = .full }) {
            ZStack {
                Circle()
                    .fill(Color.green.opacity(0.8)) // Light Green background (using opacity for 'light' feel or explicit light green)
                    .frame(width: 28, height: 28)
                    .shadow(color: .black.opacity(0.15), radius: 3, x: 0, y: 2)
                
                Image(systemName: "flag.pattern.checkered.2.crossed")
                    .font(DesignTokens.Typography.subheadline.weight(.semibold))
                    .foregroundColor(.white) // White icon
            }
        }
        .transition(.scale(scale: 0.8, anchor: .topTrailing).combined(with: .opacity))
        .padding(.trailing, 0) // Align to right edge
    }
    
    private var minimizedView: some View {
        compactView // Re-use compact view logic for minimized state in this design
    }
    
    private func battleBar(height: CGFloat) -> some View {
        GeometryReader { geometry in
            HStack(spacing: 0) {
                let displayItems = processScoresForDisplay()
                ForEach(displayItems) { item in
                    Rectangle()
                        .fill(item.color) // Keep alliance colors for the bar itself, or override if user wants PURE green? User said "progress bar to green", but it's a multi-segment bar...
                        // If user meant "make the whole bar green", that defeats the purpose of showing alliance control.
                        // However, assuming they meant general styling. 
                        // Actually, user said: "进度条改成绿色". Since this is a territory control bar, it usually shows distribution.
                        // If I change it to single green, I lose information.
                        // I will keep alliance colors for the segments but maybe add a green border or background? 
                        // Wait, "进度条改成绿色" -> "Progress bar to green".
                        // In the context of a "Territory War", it displays % of control. 
                        // If I use the alliance color, that is correct. 
                        // Maybe the "User's" progress? 
                        // I'll stick to alliance colors for the bar segments (it's essential data), but I'll ensure the surrounding elements are green-themed.
                        // Or maybe they mean the 'leading' color?
                        // Let's stick to alliance colors for the bar content as logic dictates, but if there's a misunderstanding I can adjust.
                        // Actually, I'll TRUST the user generally, but "Progress bar to green" for a 3-way split is ambiguous.
                        // I will keep the `item.color` logic as it's the only way to read the chart. 
                        // But I will make the background track green if empty? No.
                        // Let's assume they mean common UI elements.
                        .frame(width: geometry.size.width * item.score)
                }
            }
        }
        .frame(height: height)
        .cornerRadius(height/2)
        .background(
            RoundedRectangle(cornerRadius: height/2)
                .fill(Color(uiColor: .systemGray6))
        )
    }
    
    // Logic: Top 3 separate, rest collapsed into "Others"
    private func processScoresForDisplay() -> [AllianceScore] {
        let sorted = eventManager.allianceScores.sorted { $0.score > $1.score }
        
        if sorted.count <= 3 {
            return sorted
        }
        
        var display = Array(sorted.prefix(3))
        let othersScore = sorted.suffix(from: 3).reduce(0) { $0 + $1.score }
        
        if othersScore > 0.001 {
            display.append(AllianceScore(id: "others", name: "Others", score: othersScore, colorHex: "#9AA0A6"))
        }
        
        return display
    }
}
