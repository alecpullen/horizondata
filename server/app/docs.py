"""
API Documentation module for rendering OpenAPI specifications with Redocly.
"""
import os
from flask import Blueprint, render_template_string
import yaml

docs_bp = Blueprint('docs', __name__)

# Redocly HTML template
REDOC_HTML_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <title>{{ title }}</title>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet">
    <style>
        body {
            margin: 0;
            padding: 0;
        }
    </style>
</head>
<body>
    <div id="redoc"></div>
    <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
    <script>
        var spec = {{ spec_json | safe }};
        Redoc.init(spec, {
            scrollYOffset: 0,
            hideDownloadButton: true,
            hideHostname: false,
            theme: {
                colors: {
                    primary: {
                        main: '#1890ff'
                    }
                },
                typography: {
                    fontSize: '14px',
                    lineHeight: '1.5em',
                    code: {
                        fontSize: '13px',
                        fontFamily: 'Courier, monospace',
                        fontWeight: '400',
                        backgroundColor: '#f0f0f0',
                        borderRadius: '3px'
                    },
                    headings: {
                        fontFamily: 'Montserrat, sans-serif',
                        fontWeight: '400'
                    }
                }
            }
        }, document.getElementById('redoc'));
    </script>
</body>
</html>
"""

def load_openapi_spec():
    """Load the OpenAPI specification from the YAML file."""
    spec_path = os.path.join(os.path.dirname(__file__), 'oapi.yaml')
    try:
        with open(spec_path, 'r', encoding='utf-8') as file:
            return yaml.safe_load(file)
    except FileNotFoundError:
        return None
    except yaml.YAMLError as e:
        print(f"Error parsing OpenAPI spec: {e}")
        return None

@docs_bp.route('/')
def api_docs():
    """Render the API documentation using Redocly."""
    spec = load_openapi_spec()
    if spec is None:
        return {"error": "OpenAPI specification not found"}, 404
    
    import json
    spec_json = json.dumps(spec)
    
    return render_template_string(
        REDOC_HTML_TEMPLATE,
        title=spec.get('info', {}).get('title', 'API Documentation'),
        spec_json=spec_json
    )

@docs_bp.route('/openapi.yaml')
def openapi_spec():
    """Serve the raw OpenAPI specification."""
    spec = load_openapi_spec()
    if spec is None:
        return {"error": "OpenAPI specification not found"}, 404
    
    from flask import Response
    import yaml
    
    yaml_content = yaml.dump(spec, default_flow_style=False, allow_unicode=True)
    return Response(yaml_content, mimetype='application/x-yaml')
