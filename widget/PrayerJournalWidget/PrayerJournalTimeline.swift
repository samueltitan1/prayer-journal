import Foundation
import WidgetKit

private let WIDGET_APP_GROUP = "group.app.prayerjournal.widget"
private let WIDGET_AUTH_UPDATED_AT_KEY = "widget_auth_updated_at"

private func timelineRefreshDate(from now: Date) -> Date {
    guard
        let defaults = UserDefaults(suiteName: WIDGET_APP_GROUP),
        let updatedAt = defaults.object(forKey: WIDGET_AUTH_UPDATED_AT_KEY) as? NSNumber
    else {
        return Calendar.current.date(byAdding: .minute, value: 5, to: now) ?? now.addingTimeInterval(300)
    }

    let updatedAtDate = Date(timeIntervalSince1970: updatedAt.doubleValue / 1000.0)
    let isRecentlyUpdated = now.timeIntervalSince(updatedAtDate) <= 120
    if isRecentlyUpdated {
        return now.addingTimeInterval(30)
    }
    return Calendar.current.date(byAdding: .minute, value: 5, to: now) ?? now.addingTimeInterval(300)
}

struct PrayerJournalTimelineEntry: TimelineEntry {
    let date: Date
    let content: WidgetEntry
}

struct PrayerJournalTimelineProvider: TimelineProvider {
    func placeholder(in context: Context) -> PrayerJournalTimelineEntry {
        let now = Date()
        return PrayerJournalTimelineEntry(date: now, content: getDailyContent(for: now))
    }

    func getSnapshot(in context: Context, completion: @escaping (PrayerJournalTimelineEntry) -> Void) {
        let now = Date()
        completion(PrayerJournalTimelineEntry(date: now, content: getDailyContent(for: now)))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<PrayerJournalTimelineEntry>) -> Void) {
        let now = Date()
        let entry = PrayerJournalTimelineEntry(date: now, content: getDailyContent(for: now))
        let refreshDate = timelineRefreshDate(from: now)
        let timeline = Timeline(entries: [entry], policy: .after(refreshDate))
        completion(timeline)
    }
}
