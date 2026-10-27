import { getWidgetDesignCapabilities } from '@/lib/widgets/design-capabilities';

export function GET() {
  return Response.json(getWidgetDesignCapabilities(), { headers:{'Cache-Control':'public, max-age=300'} });
}
