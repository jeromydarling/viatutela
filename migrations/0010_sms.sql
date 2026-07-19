-- Twilio SMS: where the shelter wants "new application" texts sent.
ALTER TABLE orgs ADD COLUMN sms_number TEXT;
