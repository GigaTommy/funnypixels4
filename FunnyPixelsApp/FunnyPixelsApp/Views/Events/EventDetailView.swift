import SwiftUI

struct EventDetailView: View {
    @ObservedObject private var fontManager = FontSizeManager.shared
    let event: EventService.Event
    @State private var userStatus: EventService.UserEventStatus?
    @State private var isLoading = false
    @State private var isSigningUp = false
    @State private var showRewards = false
    @State private var showSignupSheet = false
    @State private var userAlliances: [AllianceService.Alliance] = []
    @State private var errorMessage: String?
    @State private var signupStats: EventSignupStats?
    @State private var userContribution: EventContribution?
    @State private var isLoadingStats = false
    @State private var isLoadingContribution = false
    @StateObject private var eventManager = EventManager.shared
    @Environment(\.dismiss) var dismiss
    
    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                // P0 - Core Information (Top Priority)

                // 1. Header with Banner
                headerView

                // 2. Event Countdown Card - NEW
                EventCountdownCard(event: event)
                    .padding(.horizontal)

                // 3. Event Location Card - NEW
                EventLocationCard(event: event)
                    .padding(.horizontal)

                // 4. Status & Action Card
                statusSection
                    .padding(.horizontal)

                // P1 - Important Information

                // 5. Requirements Card - NEW
                EventRequirementsCard(event: event)
                    .padding(.horizontal)

                // 6. Info Grid (Time, Rules)
                infoGrid
                    .padding(.horizontal)

                // 7. Rewards Teaser (only location for rewards - toolbar button removed)
                rewardsTeaser
                    .padding(.horizontal)

                // 8. Signup Statistics (if event is published or active)
                if event.status == "published" || event.status == "active" {
                    if isLoadingStats {
                        ProgressView()
                            .frame(maxWidth: .infinity)
                            .padding()
                    } else if let stats = signupStats {
                        EventSignupStatsView(stats: stats)
                            .padding(.horizontal)
                    }
                }

                // 9. Difficulty Rating (P2-2)
                if let gameplay = event.gameplay {
                    DifficultyRatingView(difficulty: gameplay.difficulty, compact: false)
                        .padding(.horizontal)
                }

                // 10. Gameplay Guide (if gameplay data exists)
                if let gameplay = event.gameplay {
                    EventGameplayView(gameplay: gameplay)
                        .padding(.horizontal)
                }

                // P2 - Enhancement Information

                // 11. User Contribution (if user is signed up)
                if let status = userStatus, status.signedUp {
                    if isLoadingContribution {
                        ProgressView()
                            .frame(maxWidth: .infinity)
                            .padding()
                    } else if let contribution = userContribution {
                        EventContributionCard(contribution: contribution)
                            .padding(.horizontal)
                    }
                }

                Spacer()
            }
            .padding(.bottom, 32)
        }
        .background(Color(uiColor: .systemGroupedBackground))
        .navigationBarTitle(event.title, displayMode: .inline)
        .sheet(isPresented: $showRewards) {
            EventRewardsView(event: event)
        }
        .task {
            await fetchStatus()
            await fetchSignupStats()
        }
        .onChange(of: userStatus?.signedUp) { oldValue, newValue in
            if newValue == true {
                Task {
                    await fetchUserContribution()
                }
            }
        }
        .alert("Error", isPresented: Binding<Bool>(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "")
        }
        .sheet(isPresented: $showSignupSheet) {
            SignupSheet(
                event: event,
                alliances: userAlliances,
                isSigningUp: $isSigningUp,
                onSignup: { type, allianceId in
                    Task {
                        await performSignup(type: type, allianceId: allianceId)
                    }
                }
            )
            .presentationDetents([.medium])
            .presentationDragIndicator(.visible)
        }
    }
    
    // MARK: - Subviews
    
    private var headerView: some View {
        ZStack(alignment: .bottomLeading) {
            if let bannerUrl = event.bannerUrl, let url = URL(string: bannerUrl) {
                AsyncImage(url: url) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    Color.gray.opacity(0.3)
                }
                .frame(height: 200)
                .clipped()
            } else {
                Rectangle()
                    .fill(LinearGradient(colors: [.blue, .purple], startPoint: .topLeading, endPoint: .bottomTrailing))
                    .frame(height: 200)
            }
            
            // Gradient Overlay
            LinearGradient(colors: [.clear, .black.opacity(0.6)], startPoint: .top, endPoint: .bottom)
                .frame(height: 100)
            
            VStack(alignment: .leading, spacing: 4) {
                Text(event.status.uppercased())
                    .font(.caption.weight(.bold))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(statusColor)
                    .foregroundColor(.white)
                    .cornerRadius(4)
                
                Text(event.title)
                    .font(.title2.weight(.bold)) // DesignTokens style
                    .foregroundColor(.white)
            }
            .padding()
        }
    }
    
    private var statusSection: some View {
        VStack(spacing: 16) {
            if isLoading {
                ProgressView()
                    .frame(maxWidth: .infinity, minHeight: 100)
            } else if let status = userStatus {
                if status.signedUp {
                    // Already Signed Up
                    VStack(spacing: 12) {
                        if #available(iOS 18.0, *) {
                            Image(systemName: "checkmark.circle.fill")
                                .font(.system(size: 48))
                                .foregroundColor(.green)
                                .symbolEffect(.bounce)
                        } else {
                            Image(systemName: "checkmark.circle.fill")
                                .font(.system(size: 48))
                                .foregroundColor(.green)
                        }
                        
                        Text(NSLocalizedString("event.signed_up", comment: "You are signed up!"))
                            .font(.headline)
                        
                        if let joinedAt = status.joinedAt {
                            Text("\(NSLocalizedString("event.joined_at", comment: "Joined at")): \(formatDate(joinedAt))")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color(uiColor: .secondarySystemGroupedBackground))
                    .cornerRadius(12)
                } else {
                    // Not Signed Up - Action
                    VStack(spacing: 12) {
                        Text(NSLocalizedString("event.signup_prompt", comment: "Join the battle and earn rewards!"))
                            .font(.headline)
                            .multilineTextAlignment(.center)

                        if event.status == "published" || event.status == "active" {
                            Button(action: {
                                Task {
                                    await loadUserAlliances()
                                    showSignupSheet = true
                                }
                            }) {
                                HStack {
                                    if isSigningUp {
                                        ProgressView().tint(.white)
                                    } else {
                                        Text(NSLocalizedString("event.signup_btn", comment: "Sign Up Now"))
                                            .fontWeight(.bold)
                                    }
                                }
                                .frame(maxWidth: .infinity)
                                .padding()
                                .background(Color.blue)
                                .foregroundColor(.white)
                                .cornerRadius(12)
                            }
                            .disabled(isSigningUp)
                        } else {
                            Text(NSLocalizedString("event.signup_closed", comment: "Signup Closed"))
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                                .padding()
                                .background(Color.gray.opacity(0.1))
                                .cornerRadius(8)
                        }
                    }
                    .padding()
                    .background(Color(uiColor: .secondarySystemGroupedBackground))
                    .cornerRadius(12)
                }
            }
        }
    }
    
    private var infoGrid: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 16) {
            infoCard(icon: "clock", title: NSLocalizedString("event.start_time", comment: "Start"), value: formatDate(event.startTime))
            infoCard(icon: "flag.checkered", title: NSLocalizedString("event.end_time", comment: "End"), value: formatDate(event.endTime))
            if let config = event.config {
                if let score = config.rules?.pixelScore {
                    infoCard(icon: "star.circle.fill", title: NSLocalizedString("event.pixel_score", comment: "Pixel Score"), value: "\(score) pts")
                }
            }
        }
    }
    
    private func infoCard(icon: String, title: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: icon)
                    .foregroundColor(.blue)
                Text(title)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            Text(value)
                .font(.subheadline.weight(.medium))
                .foregroundColor(.primary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(uiColor: .secondarySystemGroupedBackground))
        .cornerRadius(12)
    }
    
    private var rewardsTeaser: some View {
        Button(action: { showRewards = true }) {
            HStack {
                Image(systemName: "gift.fill")
                    .font(.title2)
                    .foregroundColor(.orange)
                    .padding(12)
                    .background(Color.orange.opacity(0.1))
                    .clipShape(Circle())
                
                VStack(alignment: .leading) {
                    Text(NSLocalizedString("event.rewards.title", comment: "Event Rewards"))
                        .font(.headline)
                        .foregroundColor(.primary)
                    Text(NSLocalizedString("event.rewards.subtitle_short", comment: "Click to view details"))
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                Spacer()
                
                Image(systemName: "chevron.right")
                    .foregroundColor(.gray)
            }
            .padding()
            .background(Color(uiColor: .secondarySystemGroupedBackground))
            .cornerRadius(12)
        }
    }
    
    // MARK: - Helpers
    
    private var statusColor: Color {
        switch event.status {
        case "active": return .green
        case "published": return .blue
        case "ended": return .gray
        default: return .orange
        }
    }
    
    private func formatDate(_ dateString: String) -> String {
        // Simplified date formatting
        // In real app, use dedicated DateFormatter helper
        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = isoFormatter.date(from: dateString) {
            let formatter = DateFormatter()
            formatter.dateStyle = .medium
            formatter.timeStyle = .short
            return formatter.string(from: date)
        }
        return dateString
    }
    
    // MARK: - Actions
    
    private func fetchStatus() async {
        isLoading = true
        do {
            let status = try await EventService.shared.getMyStatus(eventId: event.id)
            await MainActor.run {
                self.userStatus = status
                self.isLoading = false
            }
        } catch {
            await MainActor.run {
                // Ignore error if not signed up? No, backend returns {signedUp: false}
                // Error means network failure
                Logger.error("Failed to fetch status: \(error)")
                self.isLoading = false
            }
        }
    }
    
    private func loadUserAlliances() async {
        do {
            let alliances = try await AllianceService.shared.fetchUserAlliances()
            await MainActor.run {
                self.userAlliances = alliances
            }
        } catch {
            Logger.error("Failed to load alliances: \(error)")
        }
    }

    private func performSignup(type: String, allianceId: String?) async {
        isSigningUp = true
        showSignupSheet = false

        do {
            let success = try await EventService.shared.signup(
                eventId: event.id,
                type: type,
                participantId: allianceId
            )
            if success {
                await fetchStatus()
                await fetchSignupStats()
                await fetchUserContribution()
            }
        } catch {
            await MainActor.run {
                self.errorMessage = error.localizedDescription
            }
        }

        isSigningUp = false
    }

    private func fetchSignupStats() async {
        guard event.status == "published" || event.status == "active" else { return }

        await MainActor.run { isLoadingStats = true }

        do {
            let stats = try await EventService.shared.getSignupStats(eventId: event.id)
            await MainActor.run {
                self.signupStats = stats
                self.isLoadingStats = false
            }
        } catch {
            Logger.error("Failed to fetch signup stats: \(error)")
            await MainActor.run {
                self.isLoadingStats = false
            }
        }
    }

    private func fetchUserContribution() async {
        guard let status = userStatus, status.signedUp else { return }

        await MainActor.run { isLoadingContribution = true }

        do {
            let contribution = try await EventService.shared.getMyContribution(eventId: event.id)
            await MainActor.run {
                self.userContribution = contribution
                self.isLoadingContribution = false
            }
        } catch {
            Logger.error("Failed to fetch user contribution: \(error)")
            await MainActor.run {
                self.isLoadingContribution = false
            }
        }
    }
}

// MARK: - Signup Sheet

private struct SignupSheet: View {
    let event: EventService.Event
    let alliances: [AllianceService.Alliance]
    @Binding var isSigningUp: Bool
    let onSignup: (String, String?) -> Void
    @Environment(\.dismiss) var dismiss

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                // Header
                VStack(spacing: 8) {
                    Image(systemName: "flag.2.crossed.fill")
                        .font(.system(size: 40))
                        .foregroundColor(.blue)
                    Text(NSLocalizedString("event.signup.title", comment: "Join Event"))
                        .font(.title2.weight(.bold))
                    Text(event.title)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                .padding(.top, 16)

                // Options
                VStack(spacing: 12) {
                    // Individual signup
                    SignupOptionCard(
                        icon: "person.fill",
                        title: NSLocalizedString("event.signup.individual", comment: "Join as Individual"),
                        subtitle: NSLocalizedString("event.signup.individual.desc", comment: "Compete on your own"),
                        isLoading: isSigningUp
                    ) {
                        onSignup("user", nil)
                    }

                    // Alliance signup options
                    if !alliances.isEmpty {
                        Divider()
                            .padding(.vertical, 8)

                        Text(NSLocalizedString("event.signup.or_with_alliance", comment: "Or join with your alliance"))
                            .font(.caption)
                            .foregroundColor(.secondary)

                        ForEach(alliances, id: \.id) { alliance in
                            SignupOptionCard(
                                icon: "flag.fill",
                                title: alliance.name,
                                subtitle: NSLocalizedString("event.signup.alliance.desc", comment: "Join as alliance member"),
                                allianceColor: Color(hex: alliance.color ?? "#007AFF") ?? .blue,
                                isLoading: isSigningUp
                            ) {
                                onSignup("alliance", String(alliance.id))
                            }
                        }
                    }
                }
                .padding(.horizontal)

                Spacer()
            }
            .navigationBarTitleDisplayMode(.inline)
        .hideTabBar()
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(NSLocalizedString("common.cancel", comment: "Cancel")) {
                        dismiss()
                    }
                }
            }
        }
    }
}

private struct SignupOptionCard: View {
    let icon: String
    let title: String
    let subtitle: String
    var allianceColor: Color = .blue
    let isLoading: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 16) {
                ZStack {
                    Circle()
                        .fill(allianceColor.opacity(0.1))
                        .frame(width: 44, height: 44)
                    Image(systemName: icon)
                        .font(.title3)
                        .foregroundColor(allianceColor)
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.headline)
                        .foregroundColor(.primary)
                    Text(subtitle)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                Spacer()

                if isLoading {
                    ProgressView()
                } else {
                    Image(systemName: "chevron.right")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            .padding()
            .background(Color(uiColor: .secondarySystemGroupedBackground))
            .cornerRadius(12)
        }
        .disabled(isLoading)
    }
}
