-- SNS掲載可否カラムを追加
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS sns_permission TEXT DEFAULT '未確認';
