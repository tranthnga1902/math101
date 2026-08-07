update metadata_options set label = convert_from(decode('c490616e6720686fe1baa17420c491e1bb996e67', 'hex'), 'UTF8'), updated_at = now()
where category = 'USER_STATUS' and value = 'ACTIVE';

update metadata_options set label = convert_from(decode('c490c3a3206b68c3b361', 'hex'), 'UTF8'), updated_at = now()
where category = 'USER_STATUS' and value = 'LOCKED';

update metadata_options set label = convert_from(decode('54e1baa16d206e67c6b06e67', 'hex'), 'UTF8'), updated_at = now()
where category = 'USER_STATUS' and value = 'INACTIVE';

update metadata_options set label = convert_from(decode('4cc6b075207472e1bbaf', 'hex'), 'UTF8'), updated_at = now()
where category = 'USER_STATUS' and value = 'ARCHIVED';

update metadata_options set label = convert_from(decode('c490616e672068e1bb8d63', 'hex'), 'UTF8'), updated_at = now()
where category = 'CLASS_STATUS' and value = 'ACTIVE';

update metadata_options set label = convert_from(decode('c490c3a3206b68c3b361', 'hex'), 'UTF8'), updated_at = now()
where category = 'CLASS_STATUS' and value = 'LOCKED';

update metadata_options set label = convert_from(decode('4cc6b075207472e1bbaf', 'hex'), 'UTF8'), updated_at = now()
where category = 'CLASS_STATUS' and value = 'ARCHIVED';

update metadata_options set label = convert_from(decode('4e68c3a170', 'hex'), 'UTF8'), updated_at = now()
where category in ('COURSE_STATUS', 'PUBLISH_STATUS') and value = 'DRAFT';

update metadata_options set label = convert_from(decode('c490c3a3207875e1baa5742062e1baa36e', 'hex'), 'UTF8'), updated_at = now()
where category in ('COURSE_STATUS', 'PUBLISH_STATUS') and value = 'PUBLISHED';

update metadata_options set label = convert_from(decode('c490c3a320e1baa96e', 'hex'), 'UTF8'), updated_at = now()
where category in ('COURSE_STATUS', 'PUBLISH_STATUS') and value = 'HIDDEN';

update metadata_options set label = convert_from(decode('4cc6b075207472e1bbaf', 'hex'), 'UTF8'), updated_at = now()
where category in ('COURSE_STATUS', 'PUBLISH_STATUS') and value = 'ARCHIVED';
