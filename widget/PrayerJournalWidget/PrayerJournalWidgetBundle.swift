import SwiftUI
import WidgetKit

struct PrayerJournalSmallWidget: Widget {
    let kind: String = "PrayerJournalSmall"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: PrayerJournalTimelineProvider()) { entry in
            PrayerJournalSmallWidgetView(entry: entry)
        }
        .configurationDisplayName("Daily Prayer")
        .description("A daily verse or reflection for your prayer life.")
        .supportedFamilies([.systemSmall])
    }
}

struct PrayerJournalMediumWidget: Widget {
    let kind: String = "PrayerJournalMedium"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: PrayerJournalTimelineProvider()) { entry in
            PrayerJournalMediumWidgetView(entry: entry)
        }
        .configurationDisplayName("Daily Prayer & Journal")
        .description("A daily verse or reflection with a shortcut to pray.")
        .supportedFamilies([.systemMedium])
    }
}

struct PrayerJournalLockWidget: Widget {
    let kind: String = "PrayerJournalLock"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: PrayerJournalTimelineProvider()) { entry in
            PrayerJournalLockWidgetView(entry: entry)
        }
        .configurationDisplayName("Prayer Lock Screen")
        .description("A daily verse or reflection on your lock screen.")
        .supportedFamilies([.accessoryRectangular])
    }
}

@main
struct PrayerJournalWidgetBundle: WidgetBundle {
    var body: some Widget {
        PrayerJournalSmallWidget()
        PrayerJournalMediumWidget()
        PrayerJournalLockWidget()
    }
}
