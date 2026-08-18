-- First-boot only (empty volume). DbMigrate also CREATE DATABASE IF missing for existing volumes.
-- Owner databases only. There is no leftover shared database.
CREATE DATABASE realestate_eval_attachments;
CREATE DATABASE realestate_eval_identity;
CREATE DATABASE realestate_eval_platform;
CREATE DATABASE realestate_eval_valuation;
CREATE DATABASE realestate_eval_failures;
CREATE DATABASE realestate_eval_operations;
CREATE DATABASE realestate_eval_financial;
CREATE DATABASE realestate_eval_case_study;
CREATE DATABASE realestate_eval_messaging;
