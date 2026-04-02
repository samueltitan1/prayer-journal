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
    "When did you feel most alive today? Could that be God speaking?",
    "What prayer from this week has God already answered?",
    "Have you been honest with God today — really honest?",
    "What would you say to God right now if you knew He was listening?",
    "What has God been trying to tell you that you keep putting off hearing?",
    "Who did God place on your heart today?",
    "What are you carrying tonight that you need to hand over to God?",
    "Where did you experience peace today? Where did you lose it?",
    "What emotion showed up most today? What might God be saying through it?",
    "What did today teach you about who God is?",
    "Is there something you need to confess or release before you sleep?",
    "What is God asking of you right now that you've been avoiding?",
    "What habit, thought, or pattern is God asking you to lay down?",
    "In what area of your life do you most need to trust God right now?",
    "Who needed grace from you today — and did they receive it?",
    "Where did God send you today and did you show up as He intended?",
    "How did you reflect God's love to someone today?",
    "What scripture has God been bringing to your mind lately?"
]

let BIBLE_VERSES: [(text: String, reference: String)] = [
    (
        text: "Do not be anxious about anything, but in every situation, by prayer and petition, with thanksgiving, present your requests to God.",
        reference: "Philippians 4:6"
    ),
    (
        text: "Call to me and I will answer you and tell you great and unsearchable things you do not know.",
        reference: "Jeremiah 33:3"
    ),
    (
        text: "Ask and it will be given to you; seek and you will find; knock and the door will be opened to you.",
        reference: "Matthew 7:7"
    ),
    (
        text: "Therefore confess your sins to each other and pray for each other so that you may be healed. The prayer of a righteous person is powerful and effective.",
        reference: "James 5:16"
    ),
    (
        text: "Pray continually, give thanks in all circumstances; for this is God's will for you in Christ Jesus.",
        reference: "1 Thessalonians 5:17-18"
    ),
    (
        text: "Be still and know that I am God...",
        reference: "Psalm 46:10"
    ),
    (
        text: "The Lord is near to all who call on him, to all who call on him in truth.",
        reference: "Psalm 145:18"
    ),
    (
        text: "...I have called you friends, for everything that I learned from my Father I have made known to you.",
        reference: "John 15:15"
    ),
    (
        text: "Let us approach God's throne of grace with confidence, so that we may receive mercy and find grace to help us in our time of need.",
        reference: "Hebrews 4:16"
    ),
    (
        text: "Cast all your anxiety on him because he cares for you.",
        reference: "1 Peter 5:7"
    ),
    (
        text: "Trust in the Lord with all your heart and lean not on your own understanding; in all your ways submit to him, and he will make your paths straight.",
        reference: "Proverbs 3:5-6"
    ),
    (
        text: "Those who hope in the Lord will renew their strength. They will soar on wings like eagles; they will run and not grow weary, they will walk and not be faint.",
        reference: "Isaiah 40:31"
    ),
    (
        text: "You will keep in perfect peace those whose minds are steadfast, because they trust in you.",
        reference: "Isaiah 26:3"
    ),
    (
        text: "Have I not commanded you? Be strong and courageous. Do not be afraid; do not be discouraged, for the Lord your God will be with you wherever you go.",
        reference: "Joshua 1:9"
    ),
    (
        text: "I lift up my eyes to the mountains — where does my help come from? My help comes from the Lord, the Maker of heaven and earth.",
        reference: "Psalm 121:1-2"
    ),
    (
        text: "My grace is sufficient for you, for my power is made perfect in weakness...",
        reference: "2 Corinthians 12:9"
    ),
    (
        text: "But seek first his kingdom and his righteousness, and all these things will be given to you as well.",
        reference: "Matthew 6:33"
    ),
    (
        text: "You will seek me and find me when you seek me with all your heart.",
        reference: "Jeremiah 29:13"
    ),
    (
        text: "He restores my soul. He guides me along the right paths for his name's sake.",
        reference: "Psalm 23:3"
    ),
    (
        text: "Peace I leave with you; my peace I give you. I do not give to you as the world gives. Do not let your hearts be troubled and do not be afraid.",
        reference: "John 14:27"
    ),
    (
        text: "Come to me, all you who are weary and burdened, and I will give you rest.",
        reference: "Matthew 11:28"
    ),
    (
        text: "The Lord your God is with you, the Mighty Warrior who saves. He will take great delight in you; in his love he will no longer rebuke you, but will rejoice over you with singing.",
        reference: "Zephaniah 3:17"
    ),
    (
        text: "I remain confident of this: I will see the goodness of the Lord in the land of the living.",
        reference: "Psalm 27:13"
    ),
    (
        text: "For I know the plans I have for you, declares the Lord, plans to prosper you and not to harm you, plans to give you hope and a future.",
        reference: "Jeremiah 29:11"
    ),
    (
        text: "Neither height nor depth, nor anything else in all creation, will be able to separate us from the love of God that is in Christ Jesus our Lord.",
        reference: "Romans 8:39"
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
