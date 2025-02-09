# NumPy/Pandas Code Optimizer

This web application helps optimize NumPy and Pandas code by generating multiple variations using AI and benchmarking them against sample data.

## Features

- Modern web interface with syntax highlighting
- AI-powered code optimization using DeepSeek
- Automatic performance testing with sample data
- Comparison of multiple optimization strategies

## Setup

1. Create a virtual environment:
```bash
python3 -m venv venv
source venv/bin/activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Set up environment variables:
Create a `.env` file with your DeepSeek API key:
```
REPLICATE_API_TOKEN=your_api_key_here
```

4. Run the application:
```bash
python app.py
```

5. Open your browser and navigate to `http://localhost:5000`

## Usage

1. Enter your NumPy/Pandas code in the editor
2. Click "Optimize Code"
3. Wait for the AI to generate optimized variations
4. Review the results, including execution times and any errors
5. Use the best performing version in your project

## Example

Input:
```python
df['result'] = df.groupby('category')['value'].transform('sum')
```

The optimizer will generate multiple variations and test them against sample data to find the most efficient implementation.

## Notes

- The sample data is randomly generated for testing purposes
- Execution times are averaged over multiple runs
- Some optimizations may not work with all data types or edge cases
- Always test the optimized code with your actual data