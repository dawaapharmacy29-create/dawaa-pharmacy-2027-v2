-- إنشاء جدول staff_identity_aliases لربط أسماء الموظفين المختلفة بـ staff_id واحد
CREATE TABLE IF NOT EXISTS staff_identity_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  alias_name TEXT NOT NULL,
  normalized_alias TEXT NOT NULL,
  source TEXT NOT NULL, -- 'manual', 'auto-resolve', 'invoice-import', 'review-import', etc.
  confidence DECIMAL(3,2) NOT NULL DEFAULT 0.5, -- 0.0 to 1.0
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- إنشاء index للبحث السريع
CREATE INDEX IF NOT EXISTS idx_staff_identity_aliases_normalized ON staff_identity_aliases(normalized_alias) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_staff_identity_aliases_staff_id ON staff_identity_aliases(staff_id) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_staff_identity_aliases_active ON staff_identity_aliases(active);

-- إضافة تعليقات
COMMENT ON TABLE staff_identity_aliases IS 'جدول لربط أسماء الموظفين المختلفة (مثل د أميرة، د اميرة، د/ أميرة) بـ staff_id واحد';
COMMENT ON COLUMN staff_identity_aliases.staff_id IS 'معرف الموظف الأساسي';
COMMENT ON COLUMN staff_identity_aliases.alias_name IS 'الاسم البديل الخام';
COMMENT ON COLUMN staff_identity_aliases.normalized_alias IS 'الاسم الموحد (بدون بادئات، بدون مسافات، أحرف موحدة)';
COMMENT ON COLUMN staff_identity_aliases.source IS 'مصدر الاسم البديل';
COMMENT ON COLUMN staff_identity_aliases.confidence IS 'درجة الثقة في الربط (0.0 إلى 1.0)';
COMMENT ON COLUMN staff_identity_aliases.active IS 'ما إذا كان الاسم البديل نشطاً';
COMMENT ON COLUMN staff_identity_aliases.created_by IS 'المستخدم الذي أنشأ الربط';
