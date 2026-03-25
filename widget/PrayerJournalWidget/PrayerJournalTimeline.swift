import Foundation
import WidgetKit

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
        let timeline = Timeline(entries: [entry], policy: .atEnd)
        completion(timeline)
    }
}
