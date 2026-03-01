import SwiftUI

extension Image {
    /// Check if the image exists in the bundle (is a local asset)
    static func assetExists(_ name: String) -> Bool {
        #if canImport(UIKit)
        return UIImage(named: name) != nil
        #else
        return false // Handle other platforms if necessary
        #endif
    }
}
