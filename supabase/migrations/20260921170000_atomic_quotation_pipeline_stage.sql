CREATE OR REPLACE FUNCTION update_quotation_pipeline_stage(
  _collection_id uuid,
  _new_stage text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _inq_pipeline inquiry_pipeline_status;
  _updated_count int;
BEGIN
  IF _new_stage NOT IN ('Draft', 'Sent', 'Viewed', 'Quoted', 'Negotiating', 'Approved', 'Completed', 'Cancelled') THEN
    RAISE EXCEPTION 'Invalid quotation pipeline stage: %', _new_stage;
  END IF;

  CASE _new_stage
    WHEN 'Draft' THEN _inq_pipeline := 'NEW'::inquiry_pipeline_status;
    WHEN 'Sent' THEN _inq_pipeline := 'CONTACTED'::inquiry_pipeline_status;
    WHEN 'Viewed' THEN _inq_pipeline := 'CONTACTED'::inquiry_pipeline_status;
    WHEN 'Quoted' THEN _inq_pipeline := 'QUOTED'::inquiry_pipeline_status;
    WHEN 'Negotiating' THEN _inq_pipeline := 'NEGOTIATING'::inquiry_pipeline_status;
    WHEN 'Approved' THEN _inq_pipeline := 'CLOSED'::inquiry_pipeline_status;
    WHEN 'Completed' THEN _inq_pipeline := 'CLOSED'::inquiry_pipeline_status;
    WHEN 'Cancelled' THEN _inq_pipeline := 'LOST'::inquiry_pipeline_status;
    ELSE _inq_pipeline := 'NEW'::inquiry_pipeline_status;
  END CASE;

  UPDATE collections
  SET 
    status = _new_stage,
    inquiry_status = _inq_pipeline,
    updated_at = NOW()
  WHERE id = _collection_id;

  GET DIAGNOSTICS _updated_count = ROW_COUNT;
  IF _updated_count = 0 THEN
    RAISE EXCEPTION 'Collection not found: %', _collection_id;
  END IF;

  UPDATE whatsapp_inquiries
  SET 
    status = _new_stage,
    inquiry_status = _inq_pipeline,
    updated_at = NOW()
  WHERE collection_id = _collection_id;

  RETURN jsonb_build_object(
    'success', true,
    'collection_id', _collection_id,
    'status', _new_stage,
    'inquiry_status', _inq_pipeline
  );
END;
$$;
