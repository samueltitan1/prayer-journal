export type Prayer = {
    id: string;
    user_id: string;
    prayed_at: string;
    transcript_text: string | null;
    duration_seconds: number | null;
    audio_path: string | null;
    signed_audio_url: string | null;
    is_bookmarked?: boolean;
    bible_reference?: string | null;
    bible_version?: string | null;
    bible_provider?: string | null;
    entry_source?: "audio" | "text" | "ocr" | null;
    location_name?: string | null; 
    attachment_urls?: string[]; // or string[] | null
  };