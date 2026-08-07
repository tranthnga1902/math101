update metadata_options set label = convert_from(decode('c490616e6720686fe1baa17420c491e1bb996e67', 'hex'), 'UTF8'), updated_at = now() where category = 'USER_STATUS' and value = 'ACTIVE';
update metadata_options set label = convert_from(decode('c490c3a3206b68c3b361', 'hex'), 'UTF8'), updated_at = now() where category = 'USER_STATUS' and value = 'LOCKED';
update metadata_options set label = convert_from(decode('54e1baa16d206e67c6b06e67', 'hex'), 'UTF8'), updated_at = now() where category = 'USER_STATUS' and value = 'INACTIVE';
update metadata_options set label = convert_from(decode('4cc6b075207472e1bbaf', 'hex'), 'UTF8'), updated_at = now() where category = 'USER_STATUS' and value = 'ARCHIVED';

update metadata_options set label = convert_from(decode('4e68c3a170', 'hex'), 'UTF8'), updated_at = now() where category in ('COURSE_STATUS', 'PUBLISH_STATUS') and value = 'DRAFT';
update metadata_options set label = convert_from(decode('c490c3a3207875e1baa5742062e1baa36e', 'hex'), 'UTF8'), updated_at = now() where category in ('COURSE_STATUS', 'PUBLISH_STATUS') and value = 'PUBLISHED';
update metadata_options set label = convert_from(decode('c490c3a320e1baa96e', 'hex'), 'UTF8'), updated_at = now() where category in ('COURSE_STATUS', 'PUBLISH_STATUS') and value = 'HIDDEN';
update metadata_options set label = convert_from(decode('4cc6b075207472e1bbaf', 'hex'), 'UTF8'), updated_at = now() where category in ('COURSE_STATUS', 'PUBLISH_STATUS', 'CLASS_STATUS') and value = 'ARCHIVED';

update metadata_options set label = convert_from(decode('c490616e672068e1bb8d63', 'hex'), 'UTF8'), updated_at = now() where category = 'CLASS_STATUS' and value = 'ACTIVE';
update metadata_options set label = convert_from(decode('c490c3a3206b68c3b361', 'hex'), 'UTF8'), updated_at = now() where category = 'CLASS_STATUS' and value = 'LOCKED';
update metadata_options set label = convert_from(decode('54c3a069206c69e1bb8775', 'hex'), 'UTF8'), updated_at = now() where category = 'RESOURCE_TYPE' and value = 'DOCUMENT';
update metadata_options set label = convert_from(decode('48c3ac6e6820e1baa36e68', 'hex'), 'UTF8'), updated_at = now() where category = 'RESOURCE_TYPE' and value = 'IMAGE';
update metadata_options set label = convert_from(decode('4c69c3aa6e206be1babf74', 'hex'), 'UTF8'), updated_at = now() where category = 'RESOURCE_TYPE' and value = 'LINK';
update metadata_options set label = convert_from(decode('4ee1bb99692064756e672074657874', 'hex'), 'UTF8'), updated_at = now() where category = 'RESOURCE_TYPE' and value = 'TEXT';
update metadata_options set label = convert_from(decode('43e1bba76e672063e1bb91', 'hex'), 'UTF8'), updated_at = now() where category = 'PROBLEM_DIFFICULTY' and value = 'REINFORCEMENT';
update metadata_options set label = convert_from(decode('4ec3a26e672063616f', 'hex'), 'UTF8'), updated_at = now() where category = 'PROBLEM_DIFFICULTY' and value = 'ADVANCED';
update metadata_options set label = convert_from(decode('5468e1bbad207468c3a16368', 'hex'), 'UTF8'), updated_at = now() where category = 'PROBLEM_DIFFICULTY' and value = 'CHALLENGE';
update metadata_options set label = convert_from(decode('42c3a069206c7579e1bb876e2074e1baad70', 'hex'), 'UTF8'), updated_at = now() where category = 'PROBLEM_KIND' and value = 'PRACTICE';
update metadata_options set label = convert_from(decode('42c3a069206b69e1bb836d20747261', 'hex'), 'UTF8'), updated_at = now() where category = 'PROBLEM_KIND' and value = 'EXAM';
