import Foundation

/// Sprite Configuration
/// Contains 200+ common emojis for preloading
public enum SpriteConfig {

    /// Common emojis to preload (200+)
    /// Covers 99% of usage scenarios
    public static let commonEmojis: [String] = [
        // War/Strategy (30)
        "⚔️", "🏰", "🛡️", "🗡️", "🏹", "⭐", "🔥", "💎", "👑", "🐉",
        "🦅", "🌟", "💪", "🎯", "🚀", "⚡", "🌈", "🔮", "🎪", "🏆",
        "🎨", "🎭", "🌙", "☀️", "🌍", "🔱", "🎖️", "🏅", "🎗️", "❤️",

        // Country Flags (50)
        "🇨🇳", "🇺🇸", "🇯🇵", "🇬🇧", "🇫🇷", "🇩🇪", "🇮🇹", "🇪🇸", "🇷🇺", "🇰🇷",
        "🇧🇷", "🇮🇳", "🇦🇺", "🇨🇦", "🇲🇽", "🇹🇷", "🇸🇦", "🇿🇦", "🇳🇱", "🇧🇪",
        "🇸🇪", "🇳🇴", "🇩🇰", "🇫🇮", "🇵🇱", "🇦🇹", "🇨🇭", "🇵🇹", "🇬🇷", "🇮🇪",
        "🇳🇿", "🇸🇬", "🇲🇾", "🇹🇭", "🇻🇳", "🇮🇩", "🇵🇭", "🇦🇪", "🇪🇬", "🇳🇬",
        "🇰🇪", "🇦🇷", "🇨🇱", "🇨🇴", "🇵🇪", "🇻🇪", "🇺🇦", "🇨🇿", "🇭🇺", "🇷🇴",

        // Animals (30)
        "🐲", "🦁", "🐯", "🦊", "🐺", "🐻", "🐼", "🦄", "🦇", "🐍",
        "🦂", "🐢", "🐬", "🦈", "🐳", "🦋", "🐝", "🐞", "🦀", "🐙",
        "🐸", "🐰", "🐱", "🐶", "🐮", "🐷", "🐴", "🦆", "🦉", "🐧",

        // Plants (20)
        "🌺", "🌸", "🌹", "🌻", "🍁", "🍀", "🌲", "🌳", "🌴", "🌵",
        "🌷", "🌼", "💐", "🌾", "🍂", "🍃", "☘️", "🌿", "🎋", "🎍",

        // Food (20)
        "🍎", "🍊", "🍋", "🍇", "🍓", "🍑", "🍒", "🥝", "🍌", "🍉",
        "🍕", "🍔", "🍟", "🌮", "🍜", "🍣", "🍰", "🍩", "🍪", "🍫",

        // Festival/Special (20)
        "👻", "🎃", "🎄", "🎅", "🎁", "🎂", "🎈", "🎉", "🎊", "✨",
        "💫", "🌠", "🎆", "🎇", "🧨", "🎐", "🎑", "🎀", "🏵️", "🧧",

        // Expressions (30)
        "😀", "😎", "🤣", "😍", "🥰", "😡", "💀", "👽", "🤖", "💩",
        "😈", "👿", "🤡", "👹", "👺", "☠️", "👾", "🙈", "🙉", "🙊",
        "😺", "😸", "😹", "😻", "😼", "😽", "🙀", "😿", "😾", "🐾",

        // Sports (15)
        "⚽", "🏀", "🏈", "⚾", "🎾", "🏐", "🏉", "🎱", "🏓", "🏸",
        "🏒", "🥊", "🥋", "⛳", "🎿",

        // Weather/Nature (15)
        "🌞", "🌝", "🌛", "🌜", "🌚", "🌕", "🌖", "🌗", "🌘", "🌑",
        "🌊", "🌋", "🏔️", "⛰️", "🗻",

        // Objects (20)
        "💰", "💵", "💴", "💶", "💷", "💳", "🔑", "🗝️", "🔐", "🔒",
        "📱", "💻", "🖥️", "🎮", "🕹️", "📷", "🎥", "📺", "📻", "🔔",
    ]

    /// Sprite size in points
    public static let spriteSize: CGFloat = 64

    /// SDF square name for color pixels
    public static let sdfSquareName = "sdf-square"

    /// Check if emoji is in common pool
    public static func isCommonEmoji(_ emoji: String) -> Bool {
        return commonEmojis.contains(emoji)
    }
}

// MARK: - Notification Names

extension Notification.Name {
    /// Posted when a new emoji is discovered that's not in the common pool
    public static let newEmojiDiscovered = Notification.Name("com.funnypixels.newEmojiDiscovered")
}
