import SwiftUI
import WidgetKit

private extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let r, g, b: UInt64
        switch hex.count {
        case 6:
            (r, g, b) = (int >> 16, int >> 8 & 0xFF, int & 0xFF)
        default:
            (r, g, b) = (0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255.0,
            green: Double(g) / 255.0,
            blue: Double(b) / 255.0,
            opacity: 1.0
        )
    }
}

private let widgetBackground = Color(hex: "F6F3EE")
private let primaryText = Color(hex: "1A1A1A")
private let accentText = Color(hex: "C4A572")

private struct WidgetHeaderView: View {
    var body: some View {
        Image("widget-logo")
            .resizable()
            .scaledToFit()
            .frame(width: 18, height: 18)
            .opacity(0.9)
    }
}

struct PrayerJournalSmallWidgetView: View {
    let entry: PrayerJournalTimelineEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            WidgetHeaderView()

            Spacer(minLength: 4)

            Text(entry.content.body)
                .font(.custom("Georgia", size: 13))
                .italic(entry.content.type == .verse)
                .foregroundColor(primaryText)
                .lineLimit(4)
                .minimumScaleFactor(0.8)

            if entry.content.type == .verse, let reference = entry.content.reference {
                Text(reference)
                    .font(.custom("Georgia", size: 11))
                    .foregroundColor(accentText)
                    .padding(.top, 4)
                    .lineLimit(1)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(widgetBackground)
        .widgetURL(URL(string: "prayer-journal://pray"))
    }
}

struct PrayerJournalMediumWidgetView: View {
    let entry: PrayerJournalTimelineEntry

    var body: some View {
        GeometryReader { proxy in
            let leftWidth = proxy.size.width * 0.7
            let rightWidth = proxy.size.width * 0.3

            HStack(spacing: 0) {
                VStack(alignment: .leading, spacing: 0) {
                    WidgetHeaderView()

                    Spacer(minLength: 4)

                    Text(entry.content.body)
                        .font(.custom("Georgia", size: 13))
                        .italic(entry.content.type == .verse)
                        .foregroundColor(primaryText)
                        .lineLimit(5)
                        .minimumScaleFactor(0.8)

                    if entry.content.type == .verse, let reference = entry.content.reference {
                        Text(reference)
                            .font(.custom("Georgia", size: 11))
                            .foregroundColor(accentText)
                            .padding(.top, 4)
                            .lineLimit(1)
                    }
                }
                .padding(14)
                .frame(width: leftWidth, height: proxy.size.height, alignment: .topLeading)

                Rectangle()
                    .fill(accentText)
                    .frame(width: 1)
                    .opacity(0.3)
                    .padding(.vertical, 12)

                VStack(spacing: 6) {
                    Image(systemName: "mic.fill")
                        .font(.system(size: 20, weight: .regular))
                        .foregroundColor(accentText.opacity(0.9))
                    Text(entry.content.isSignedIn ? "Pray Now" : "Open App")
                        .font(.custom("Georgia", size: 11))
                        .foregroundColor(accentText.opacity(0.9))
                }
                .padding(.horizontal, 8)
                .frame(width: rightWidth, height: proxy.size.height, alignment: .center)
            }
            .background(widgetBackground)
        }
        // WidgetKit supports one tap target for this widget configuration without AppIntents.
        .widgetURL(URL(string: "prayer-journal://pray"))
    }
}

struct PrayerJournalLockWidgetView: View {
    let entry: PrayerJournalTimelineEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            WidgetHeaderView()
                .widgetAccentable()

            Text(entry.content.body)
                .font(.custom("Georgia", size: 12))
                .italic()
                .lineLimit(2)
                .minimumScaleFactor(0.75)
                .widgetAccentable()

            if entry.content.type == .verse, let reference = entry.content.reference {
                Text(reference)
                    .font(.custom("Georgia", size: 10))
                    .lineLimit(1)
                    .widgetAccentable()
            }
        }
        .widgetURL(URL(string: "prayer-journal://pray"))
    }
}
