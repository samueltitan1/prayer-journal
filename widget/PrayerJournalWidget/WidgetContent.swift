import Foundation

enum ContentType {
    case verse
    case question
}

struct WidgetEntry {
    let type: ContentType
    let body: String
    let reference: String?
    let date: Date
}

let EXAMEN_QUESTIONS: [String] = [
    "Where did you see God today?",
    "What moment today are you most grateful for?",
    "Where did you feel God's presence — and where did you feel distant from Him?",
    "What prayer from this week has God already answered?",
    "Who did God place on your heart today?",
    "What are you carrying tonight that you need to hand over to God?",
    "Where did you experience peace today? Where did you lose it?",
    "What did today teach you about who God is?",
    "Is there something you need to confess or release before you sleep?",
    "What is God asking of you right now that you've been avoiding?"
]

let BIBLE_VERSES: [(text: String, reference: String)] = [
    (
        text: "Do not be anxious about anything, but in every situation, by prayer and petition, present your requests to God.",
        reference: "Philippians 4:6"
    ),
    (
        text: "Call to me and I will answer you.",
        reference: "Jeremiah 33:3"
    ),
    (
        text: "The prayer of a righteous person is powerful and effective.",
        reference: "James 5:16"
    ),
    (
        text: "Be still and know that I am God.",
        reference: "Psalm 46:10"
    ),
    (
        text: "Come near to God and he will come near to you.",
        reference: "James 4:8"
    ),
    (
        text: "Ask and it will be given to you; seek and you will find.",
        reference: "Matthew 7:7"
    ),
    (
        text: "Pray continually, give thanks in all circumstances.",
        reference: "1 Thessalonians 5:17–18"
    ),
    (
        text: "Cast all your anxiety on him because he cares for you.",
        reference: "1 Peter 5:7"
    ),
    (
        text: "I lift up my eyes to the mountains — where does my help come from?",
        reference: "Psalm 121:1"
    ),
    (
        text: "Let us approach God's throne of grace with confidence.",
        reference: "Hebrews 4:16"
    )
]

func getDailyContent(for date: Date) -> WidgetEntry {
    let dayOfYear = Calendar.current.ordinality(of: .day, in: .year, for: date) ?? 1
    let index = (dayOfYear / 2)

    if dayOfYear % 2 == 0 {
        let verse = BIBLE_VERSES[index % BIBLE_VERSES.count]
        return WidgetEntry(
            type: .verse,
            body: verse.text,
            reference: verse.reference,
            date: date
        )
    }

    let question = EXAMEN_QUESTIONS[index % EXAMEN_QUESTIONS.count]
    return WidgetEntry(
        type: .question,
        body: question,
        reference: nil,
        date: date
    )
}
