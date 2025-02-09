import os
import replicate
import timeit
import numpy as np
import pandas as pd
from flask import Flask, request, jsonify, render_template
from dotenv import load_dotenv

load_dotenv()
app = Flask(__name__)

def evaluate_code(code, test_data):
    setup_code = """
import numpy as np
import pandas as pd
"""
    if test_data:
        setup_code += test_data + "\n"
    
    try:
        execution_time = timeit.timeit(
            stmt=code,
            setup=setup_code,
            number=100
        ) / 100
        return True, execution_time, None
    except Exception as e:
        return False, None, str(e)

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/optimize', methods=['POST'])
def optimize():
    if not request.json or 'code' not in request.json:
        return jsonify({'error': 'No code provided'}), 400
    
    original_code = request.json['code']
    
    try:
        output = replicate.run(
            "meta/meta-llama-3-70b-instruct",
            input={
                "prompt": f"""You are a code optimization bot. Your task is to optimize Python code.

# Code to Optimize:
{original_code}

Provide three optimized variations of the code. Each variation must:
1. Work with the exact same input data structures as the original code
2. Produce the exact same output as the original code
3. Be more efficient if possible
4. Maintain proper indentation
5. Not include any data definitions (they will be provided in setup)

Format your response using exactly these markers:
STARTCODE
[code variation 1]
ENDCODE
STARTCODE
[code variation 2]
ENDCODE
STARTCODE
[code variation 3]
ENDCODE""",
                "temperature": 0.1,
                "max_length": 2048,
                "top_p": 0.9
            }
        )
        
        variations = [original_code]
        output_text = ''.join(output)
        for variation in output_text.split('STARTCODE')[1:]:
            if 'ENDCODE' in variation:
                code = variation.split('ENDCODE')[0].strip()
                if code:
                    variations.append(code)
        
        return jsonify({'variations': variations})

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/generate_tests', methods=['POST'])
def generate_tests():
    if not request.json or 'code' not in request.json:
        return jsonify({'error': 'No code provided'}), 400
    
    try:
        output = replicate.run(
            "meta/meta-llama-3-70b-instruct",
            input={
                "prompt": f"""Generate test cases for the following Python code:

{request.json['code']}

Provide three test cases that stress test the code with different data shapes. Each test case should:
1. Use numpy/pandas to generate test data
2. Focus on different dimensional challenges:
   - Test 1: Wide data (many columns, moderate rows)
   - Test 2: Tall data (many rows, moderate columns)
   - Test 3: Large data (many rows and columns)
3. Do not include any comments in the code or the code being tested. Only include the necessary code statements.

Format your response using exactly these markers:
STARTTEST
import numpy as np
import pandas as pd
[test data generation code]
ENDTEST
STARTTEST
import numpy as np
import pandas as pd
[test data generation code]
ENDTEST
STARTTEST
import numpy as np
import pandas as pd
[test data generation code]
ENDTEST""",
                "temperature": 0.1,
                "max_length": 2048,
                "top_p": 0.9
            }
        )
        
        test_cases = []
        output_text = ''.join(output)
        for test in output_text.split('STARTTEST')[1:]:
            if 'ENDTEST' in test:
                test_code = test.split('ENDTEST')[0].strip()
                if test_code:
                    test_cases.append(test_code)
        
        return jsonify({'testCases': test_cases})

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/evaluate', methods=['POST'])
def evaluate():
    if not request.json or 'variations' not in request.json or 'testCases' not in request.json:
        return jsonify({'error': 'Missing code variations or test cases'}), 400
    
    variations = request.json['variations']
    test_cases = request.json['testCases']
    
    try:
        test_list = []
        test_data_list = []
        for test_code in test_cases:
            if test_code:
                test_list.append(test_code)
                setup_lines = [line for line in test_code.split('\n') 
                             if ('import' in line.lower() or
                                 '=' in line and ('list' in line.lower() 
                                 or 'dict' in line.lower() 
                                 or 'dataframe' in line.lower() 
                                 or 'array' in line.lower()))]
                if setup_lines:
                    test_data_list.append('\n'.join(setup_lines).strip())
        
        test_data = '\n\n'.join(test_data_list) if test_data_list else None
        evaluation_test_data = test_data_list[0] if test_data_list else None
        
        results = []
        for i, code in enumerate(variations):
            success = True
            error = None
            tests_passed = 0
            execution_time = 0
            
            code = code.strip()
            
            try:
                test_namespace = {}
                full_code = f"{evaluation_test_data}\n{code}" if evaluation_test_data else code
                exec(full_code, test_namespace)
                
                for test in test_list:
                    try:
                        exec(test, test_namespace)
                        tests_passed += 1
                    except (AssertionError, Exception) as e:
                        success = False
                        error = str(e)
                
                if success:
                    success, execution_time, error = evaluate_code(code, evaluation_test_data)
                
            except Exception as e:
                success = False
                error = str(e)
            
            results.append({
                'variation': i,
                'code': code,
                'execution_time': execution_time if success else None,
                'error': error,
                'status': 'success' if success else 'error',
                'tests_passed': tests_passed,
                'total_tests': len(test_list)
            })
        
        successful_results = [r for r in results if r['status'] == 'success']
        successful_results.sort(key=lambda x: x['execution_time'])
        
        return jsonify({
            'results': results,
            'best_variation': successful_results[0] if successful_results else None,
            'test_data': test_data
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True) 