import Foundation
import Combine

/// Pixel Socket Events
/// Defines WebSocket event types for pixel updates
public enum PixelSocketEvents: String, CaseIterable {
    case pixelCreated = "pixel:created"
    case pixelUpdated = "pixel:updated"
    case pixelDeleted = "pixel:deleted"
    case batchUpdate = "pixel:batch"
    case regionUpdate = "region:update"
    case syncRequest = "sync:request"
    case syncResponse = "sync:response"
}
