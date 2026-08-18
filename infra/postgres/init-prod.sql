-- First-boot only (empty volume). DbMigrate also CREATE DATABASE IF missing for existing volumes.
-- Owner databases only. There is no leftover shared database.
CREATE DATABASE realestate_eval_prod_attachments;
CREATE DATABASE realestate_eval_prod_identity;
CREATE DATABASE realestate_eval_prod_platform;
CREATE DATABASE realestate_eval_prod_valuation;
CREATE DATABASE realestate_eval_prod_failures;
CREATE DATABASE realestate_eval_prod_operations;
CREATE DATABASE realestate_eval_prod_financial;
CREATE DATABASE realestate_eval_prod_case_study;
CREATE DATABASE realestate_eval_prod_messaging;
