import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const PDFAnalyzer = () => {
    const [pdfText, setPdfText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [analysisResult, setAnalysisResult] = useState('');
    const [preferences, setPreferences] = useState({
        domainPriority: '',
        methodPreference: '',
        performanceThreshold: '',
    });
    const fileInputRef = useRef(null);

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsLoading(true);
        setPdfText('');
        setAnalysisResult('');

        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdfjsLib = window.pdfjsLib;
            const loadingTask = pdfjsLib.getDocument(arrayBuffer);
            const pdf = await loadingTask.promise;

            let fullText = '';
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                fullText += textContent.items.map(item => item.str).join(' ') + '\n';
            }

            setPdfText(fullText);
            await analyzePDF(fullText);
        } catch (error) {
            console.error('Error parsing PDF:', error);
            alert('Error parsing PDF. Please try another file.');
        } finally {
            setIsLoading(false);
        }
    };

    const analyzePDF = async (text) => {
        if (!text) return;

        setIsLoading(true);
        setAnalysisResult('');

        try {
            const response = await fetch('http://localhost:3001/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text,
                    preferences
                })
            });

            if (!response.ok) throw new Error('Analysis failed');
            if (!response.body) throw new Error('ReadableStream not supported');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let result = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n\n').filter(line => line.trim() !== '');

                for (const line of lines) {
                    if (line === 'data: [DONE]') {
                        break;
                    }

                    if (line.startsWith('data: ')) {
                        const data = line.substring(6);
                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.content) {
                                result += parsed.content;
                                setAnalysisResult(prev => prev + parsed.content);
                            }
                        } catch (e) {
                            console.error('Error parsing JSON:', e);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error analyzing PDF:', error);
            setAnalysisResult('```\nError analyzing PDF. Please try again.\n```');
        } finally {
            setIsLoading(false);
        }
    };

    const handlePreferenceChange = (e) => {
        const { name, value } = e.target;
        setPreferences(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const triggerFileInput = () => {
        fileInputRef.current.click();
    };

    return (
        <div className="pdf-analyzer-container">
            <h1>智研文献帮手</h1>

            <div className="upload-section">
                <button onClick={triggerFileInput} disabled={isLoading}>
                    {isLoading ? '处理中...' : '上传PDF'}
                </button>
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".pdf"
                    style={{ display: 'none' }}
                    disabled={isLoading}
                />
            </div>

            <div className="preferences-section">
                <h3>偏好设置</h3>
                <div className="preference-field">
                    <label>主要领域:</label>
                    <input
                        type="text"
                        name="domainPriority"
                        value={preferences.domainPriority}
                        onChange={handlePreferenceChange}
                        placeholder="例如：计算机视觉，自然语言处理"
                    />
                </div>
                <div className="preference-field">
                    <label>方法偏好:</label>
                    <input
                        type="text"
                        name="methodPreference"
                        value={preferences.methodPreference}
                        onChange={handlePreferenceChange}
                        placeholder="例如：深度学习，统计学"
                    />
                </div>
                <div className="preference-field">
                    <label>关注重点实验结果:</label>
                    <input
                        type="text"
                        name="performanceThreshold"
                        value={preferences.performanceThreshold}
                        onChange={handlePreferenceChange}
                        placeholder="例如： >90%的准确度"
                    />
                </div>
            </div>

            {pdfText && (
                <div className="text-preview">
                    <h3>PDF文本预览</h3>
                    <textarea
                        value={pdfText.substring(0, 5000) + (pdfText.length > 5000 ? '...' : '')}
                        readOnly
                        rows={10}
                    />
                </div>
            )}

            {analysisResult && (
                <div className="analysis-result">
                    <h3>分析结果</h3>
                    <div className="markdown-content">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {analysisResult}
                        </ReactMarkdown>
                    </div>
                </div>
            )}

            {isLoading && !analysisResult && (
                <div className="loading">PDF处理中, 请稍候...</div>
            )}

            <style jsx>{`
                .markdown-content {
                    padding: 15px;
                    border: 1px solid #ddd;
                    border-radius: 5px;
                    background: white;
                    max-height: 500px;
                    overflow-y: auto;
                }
                .markdown-content pre {
                    background: #f5f5f5;
                    padding: 10px;
                    border-radius: 3px;
                    overflow-x: auto;
                }
                .markdown-content code {
                    background: #f5f5f5;
                    padding: 2px 4px;
                    border-radius: 3px;
                    font-family: monospace;
                }
                .markdown-content table {
                    border-collapse: collapse;
                    width: 100%;
                    margin: 10px 0;
                }
                .markdown-content th, .markdown-content td {
                    border: 1px solid #ddd;
                    padding: 8px;
                }
                .markdown-content th {
                    background-color: #f2f2f2;
                }
                .markdown-content blockquote {
                    border-left: 4px solid #ddd;
                    padding-left: 15px;
                    color: #666;
                    margin-left: 0;
                }
            `}</style>
        </div>
    );
};

export default PDFAnalyzer;