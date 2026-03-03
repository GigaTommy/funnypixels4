import SwiftUI

/// 话题标签输入组件（支持自动补全）
struct HashtagInputView: View {
    @Binding var selectedHashtags: [String]
    @State private var input = ""
    @State private var suggestions: [HashtagService.HashtagSuggestion] = []
    @State private var showSuggestions = false
    @FocusState private var isFocused: Bool

    let maxHashtags: Int

    init(selectedHashtags: Binding<[String]>, maxHashtags: Int = 5) {
        self._selectedHashtags = selectedHashtags
        self.maxHashtags = maxHashtags
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // 已选择的标签
            if !selectedHashtags.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(selectedHashtags, id: \.self) { tag in
                            selectedTagChip(tag)
                        }
                    }
                    .padding(.horizontal, FeedDesign.Spacing.m)
                    .padding(.vertical, FeedDesign.Spacing.s)
                }
            }

            // 输入框
            HStack(spacing: 8) {
                Image(systemName: FeedDesign.Icon.hashtag)
                    .font(FeedDesign.Typography.body)
                    .foregroundColor(FeedDesign.Colors.textTertiary)

                TextField(NSLocalizedString("feed.hashtag.search", comment: ""), text: $input)
                    .font(FeedDesign.Typography.body)
                    .focused($isFocused)
                    .onChange(of: input) { oldValue, newValue in
                        Task {
                            await fetchSuggestions(query: newValue)
                        }
                    }
                    .onSubmit {
                        addHashtag(input)
                    }

                if !input.isEmpty {
                    Button {
                        input = ""
                        suggestions = []
                    } label: {
                        Image(systemName: FeedDesign.Icon.close)
                            .font(.caption)
                            .foregroundColor(FeedDesign.Colors.textTertiary)
                    }
                }
            }
            .padding(FeedDesign.Spacing.m)
            .background(FeedDesign.Colors.surface)
            .cornerRadius(FeedDesign.Layout.cornerRadiusSmall)

            // 建议列表
            if showSuggestions && !suggestions.isEmpty {
                Divider()

                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 0) {
                        ForEach(suggestions) { suggestion in
                            Button {
                                addHashtag(suggestion.localized)
                            } label: {
                                HStack {
                                    Text("#\(suggestion.localized)")
                                        .font(FeedDesign.Typography.body)
                                        .foregroundColor(FeedDesign.Colors.text)

                                    Spacer()

                                    Text("\(suggestion.count.feedFormatted)")
                                        .font(FeedDesign.Typography.caption)
                                        .foregroundColor(FeedDesign.Colors.textTertiary)
                                }
                                .padding(.horizontal, FeedDesign.Spacing.m)
                                .padding(.vertical, FeedDesign.Spacing.s)
                            }
                            .buttonStyle(PlainButtonStyle())

                            if suggestion.id != suggestions.last?.id {
                                Divider()
                                    .padding(.leading, FeedDesign.Spacing.m)
                            }
                        }
                    }
                }
                .frame(maxHeight: 200)
                .background(FeedDesign.Colors.background)
            }

            // 提示文字
            if selectedHashtags.count >= maxHashtags {
                Text(String(format: NSLocalizedString("feed.hashtag.max_reached", comment: ""), maxHashtags))
                    .font(FeedDesign.Typography.caption)
                    .foregroundColor(FeedDesign.Colors.like)
                    .padding(.horizontal, FeedDesign.Spacing.m)
                    .padding(.top, FeedDesign.Spacing.xs)
            }
        }
        .onChange(of: isFocused) { oldValue, newValue in
            showSuggestions = newValue
        }
    }

    // MARK: - Selected Tag Chip

    private func selectedTagChip(_ tag: String) -> some View {
        HStack(spacing: 4) {
            Text("#\(tag)")
                .font(FeedDesign.Typography.caption)
                .foregroundColor(FeedDesign.Colors.text)

            Button {
                removeHashtag(tag)
            } label: {
                Image(systemName: FeedDesign.Icon.close)
                    .font(.system(size: 10))
                    .foregroundColor(FeedDesign.Colors.textTertiary)
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(FeedDesign.Colors.surface)
        .cornerRadius(FeedDesign.Layout.cornerRadiusSmall)
        .overlay(
            RoundedRectangle(cornerRadius: FeedDesign.Layout.cornerRadiusSmall)
                .stroke(FeedDesign.Colors.border, lineWidth: FeedDesign.Layout.borderWidth)
        )
    }

    // MARK: - Actions

    private func addHashtag(_ tag: String) {
        let cleanTag = tag.replacingOccurrences(of: "#", with: "").trimmingCharacters(in: .whitespaces)

        guard !cleanTag.isEmpty else { return }
        guard selectedHashtags.count < maxHashtags else { return }
        guard !selectedHashtags.contains(cleanTag) else { return }

        selectedHashtags.append(cleanTag)
        input = ""
        suggestions = []
        isFocused = true
    }

    private func removeHashtag(_ tag: String) {
        selectedHashtags.removeAll { $0 == tag }
    }

    private func fetchSuggestions(query: String) async {
        let cleanQuery = query.trimmingCharacters(in: .whitespaces)

        guard !cleanQuery.isEmpty else {
            // 显示热门话题
            await fetchTrending()
            return
        }

        do {
            suggestions = try await HashtagService.shared.getSuggestions(query: cleanQuery, limit: 10)
            showSuggestions = true
        } catch {
            Logger.error("Failed to fetch hashtag suggestions: \(error)")
            suggestions = []
        }
    }

    private func fetchTrending() async {
        do {
            suggestions = try await HashtagService.shared.getTrending(limit: 10)
            showSuggestions = true
        } catch {
            Logger.error("Failed to fetch trending hashtags: \(error)")
            suggestions = []
        }
    }
}
