import SwiftUI
import WidgetKit

private extension WidgetConfiguration {
    func withPrayerJournalContainerBackground() -> some WidgetConfiguration {
        #if swift(>=5.9)
        if #available(iOSApplicationExtension 17.0, *) {
            self.containerBackground(.clear, for: .widget)
        } else {
            self
        }
        #else
        self
        #endif
    }
}

struct PrayerJournalSmallWidget: Widget {
    let kind: String = "PrayerJournalSmall"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: PrayerJournalTimelineProvider()) { entry in
            PrayerJournalSmallWidgetView(entry: entry)
        }
        .withPrayerJournalContainerBackground()
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
        .withPrayerJournalContainerBackground()
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
        .withPrayerJournalContainerBackground()
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
