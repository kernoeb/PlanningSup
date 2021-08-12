-- public.edt definition

-- Drop table

-- DROP TABLE public.edt;

CREATE TABLE public.edt
(
  "univ"      text           NOT NULL,
  "spec"      text           NOT NULL,
  "year"      text           NOT NULL,
  "grp"       text           NOT NULL,
  "data"      jsonb          NOT NULL,
  "timestamp" timestamptz(0) NULL,
  CONSTRAINT edt_pkey PRIMARY KEY (univ, spec, year, grp)
);
