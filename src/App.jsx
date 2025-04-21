import React, { useState, useEffect, useRef } from "react";
import * as pdfjsLib from "pdfjs-dist";
import mammoth from "mammoth";
import mkmLogo from "./assets/mkmlogo.png";
import { Analytics } from "@vercel/analytics/react";

const MKMATSResumeTransformer = () => {
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [plainText, setPlainText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.js`;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    const supportedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    if (isMounted.current && selectedFile) {
      if (supportedTypes.includes(selectedFile.type)) {
        setFile(selectedFile);
        setError("");
        setPlainText("");
      } else {
        setFile(null);
        setError("Please upload a PDF or Word (.doc, .docx) file.");
        setPlainText("");
      }
    }
  };

  const normalizeBullets = (text) => {
    const bulletRegex = /[\u2022\u2023\u25E6\u2043\u2219\u25CF\u25CB\u25A0*\u204C\u204D\u204E\u204F\u2756\u2766\u2776\u2777\u2778\u2779\u277A\u277B\u277C\u277D\u277E\u277F]/g;
    let normalizedText = text.replace(bulletRegex, "*");
    const sectionHeaders = [
      "Skills", "Experience", "Professional Experience", "Work History", "Education",
      "Licenses & Certifications", "Honors & Awards", "Accomplishments"
    ];
    const lines = normalizedText.split("\n");
    const result = [];
    let isListSection = false;
    let isSkillsSection = false;

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (sectionHeaders.some(header => trimmedLine.toLowerCase() === header.toLowerCase())) {
        isListSection = trimmedLine.toLowerCase().includes("skills") ? (isSkillsSection = true) : (isListSection = true, isSkillsSection = false);
        result.push(trimmedLine, "");
        continue;
      }

      if (isSkillsSection) {
        const items = trimmedLine.split(/\*\s*|\s*,\s*/).map(item => item.trim()).filter(item => item && item !== "&");
        if (items.length > 1) {
          result.push(...items.map(item => `* ${item}`));
          continue;
        }
      }

      if (isListSection && trimmedLine.match(/^\s*\*/)) {
        result.push(trimmedLine.replace(/^\s*\*\s*/, "* "));
        continue;
      }

      result.push(trimmedLine.replace(/^\s*\*\s*/, ""));
    }

    return result.map(line => line.trim().replace(/\s+/g, " ")).filter(Boolean).join("\n");
  };

  const handleConvert = async () => {
    if (!file) return setError("Please select a file to convert.");
    if (!isMounted.current) return;

    setIsProcessing(true);
    setError("");
    let extractedText = "";

    try {
      const reader = new FileReader();
      const readFileAsync = (file) =>
        new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsArrayBuffer(file);
        });

      const fileData = await readFileAsync(file);

      if (file.type === "application/pdf") {
        const pdfDoc = await pdfjsLib.getDocument({ data: fileData }).promise;
        for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
          const page = await pdfDoc.getPage(pageNum);
          const textContent = await page.getTextContent();
          let lastY = null;
          let pageText = "";
          for (const item of textContent.items) {
            const currentY = item.transform[5];
            if (lastY !== null && Math.abs(currentY - lastY) > 3) {
              pageText += "\n";
            }
            pageText += item.str + " ";
            lastY = currentY;
          }
          extractedText += pageText + "\n";
        }
      } else {
        const result = await mammoth.extractRawText({ arrayBuffer: fileData });
        extractedText = result.value;
      }

      const normalizedText = normalizeBullets(extractedText);
      if (isMounted.current) setPlainText(normalizedText);
    } catch (err) {
      if (isMounted.current) {
        setError("File conversion failed: " + err.message);
        setPlainText("");
      }
    } finally {
      if (isMounted.current) setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!plainText) return setError("No text has been extracted yet.");
    const blob = new Blob([plainText], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "converted_resume.txt";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="bg-gray-100 flex flex-col items-center justify-center w-full min-h-screen py-4 px-4 sm:px-6 lg:px-8">
      <div className="w-full flex flex-col items-center">
        <img src={mkmLogo} alt="MKM Logo" className="h-2 mb-1 logo" />
        <p className="text-center text-xs font-semibold text-gray-700 mb-2 slogan">
          Two Resumes. One Sharp Approach.
        </p>
        <h2 className="text-center text-2xl font-bold text-gray-900 mb-2">
          Unlock More Interviews: Optimize Your Resume for ATS
        </h2>
        <p className="text-center text-xs text-gray-600 mb-4">
          Simply upload your resume (PDF or Word) and get an ATS-ready version in seconds.
        </p>

        <div className="max-w-lg w-full bg-white rounded-lg shadow-xl p-6 space-y-3">
          <div className="mb-4">
            <label htmlFor="file-upload" className="block text-sm font-medium text-gray-700 text-center"></label>
            <input
              id="file-upload"
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={handleFileChange}
              disabled={isProcessing}
              className="mt-1 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full mx-auto text-sm border-gray-300 rounded-md"
            />
          </div>

          {error && (
            <div className="text-sm text-red-500 bg-red-100 border border-red-300 rounded-md p-3 text-center">
              {error}
            </div>
          )}

          <div className="flex justify-center space-x-4 mb-6">
            <button
              onClick={handleConvert}
              disabled={isProcessing}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 mt-6"
            >
              {isProcessing ? "Processing..." : "Optimize My Resume"}
            </button>
            {plainText && (
              <button
                onClick={handleDownload}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 mt-6"
              >
                Download Text
              </button>
            )}
          </div>

          {plainText && (
            <div className="rounded-md bg-gray-50 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900 text-center w-full">
                  Extracted Text Preview
                </h3>
              </div>
              <div className="mt-2 text-sm text-gray-800 whitespace-pre-wrap break-words">
                <pre className="text-left">{plainText}</pre>
              </div>
            </div>
          )}
        </div>

        <div className="max-w-lg w-full mt-6 about-section">
          <h3 className="text-center text-lg font-semibold text-gray-900 mb-2">
            About MKM SharpResume
          </h3>
          <p className="text-center text-sm text-gray-600">
            MKM SharpResume transforms visually compelling resumes into ATS-compliant formats, ensuring job seekers can stand out to both hiring algorithms and recruiters. Our mission is to level the playing field so candidates are evaluated for their skills—not their ability to navigate ATS constraints. We appreciate any feedback you may give for future features and optimization. (Beta v1.0.0)
          </p>
        </div>

        <div className="max-w-lg w-full mt-4">
          <p className="text-center text-sm">
            <a
              href="https://forms.office.com/r/hJGrPiw4aB"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 hover:text-indigo-800 font-medium"
            >
              Feedback
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default MKMATSResumeTransformer;