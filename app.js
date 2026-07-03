/**
 * PUBLIC CRYPTO CHART PROTOTYPE
 * وەشانی نوێکراوە بۆ چارەسەری کێشەی هێماکان و دڵنیابوونەوە لە داتا
 */

let priceChart, rsiChart, macdChart, candlestickSeries, smaSeries, bbUpperSeries, bbLowerSeries, volumeSeries, rsiSeries, macdSeries, signalSeries, histSeries, currentWs, geckoRefreshInterval;
let ema50Series, ema200Series, vwapSeries;



window.loadDexChart = async function(network, poolAddress, tokenAddress = '', isRefresh = false, interval = '1h') {
    try {
        window.currentIsBinance = false;
        window.currentNetwork = network;
        window.currentPoolAddress = poolAddress;
        window.currentTokenAddress = tokenAddress;
        window.currentInterval = interval;

        const url = `/api/gecko-candles?network=${network}&pool=${poolAddress}&token=${tokenAddress}&interval=${interval}`;
        const response = await fetch(url);
        const rawData = await response.json();

        // ❗️ پێویستە دڵنیا بین کە داتا بەردەستە
        if (!rawData || !rawData.data || !rawData.data.attributes || !rawData.data.attributes.ohlcv_list) {
            console.warn("GeckoTerminal data not available for this pool.");
            if (document.getElementById('placeholderText')) {
                document.getElementById('placeholderText').innerText = "هیچ داتایەک لە GeckoTerminal دەستنەکەوت بۆ ئەم دراوە.";
                document.getElementById('placeholderText').style.color = "#ef5350";
                document.getElementById('placeholderText').style.display = "block";
                document.getElementById('searchBtn').innerText = "گەڕان";
                document.getElementById('searchBtn').disabled = false;
            }
            return false;
        }

        const ohlcv = rawData.data.attributes.ohlcv_list;
        
        // گۆڕینی نرخ بۆ مارکێت کەپ بۆ ئەوەی چارتەکە زیاتر ڕوون بێت بۆ دراوە میمکۆینەکان
        let mcapMultiplier = 1;
        if (window.currentCoinPrice && window.currentCoinMcap && window.currentCoinPrice > 0) {
            mcapMultiplier = window.currentCoinMcap / window.currentCoinPrice;
        }

        const formattedData = ohlcv.map(d => ({
            time: Math.floor(d[0]), // لە جیگکۆتێرمیناڵ کاتەکە بە چرکەیە
            open: parseFloat(d[1]) * mcapMultiplier,
            high: parseFloat(d[2]) * mcapMultiplier,
            low: parseFloat(d[3]) * mcapMultiplier,
            close: parseFloat(d[4]) * mcapMultiplier,
            volume: parseFloat(d[5])
        })).reverse(); // پێچەوانەی دەکەینەوە چونکە جیگکۆتێرمیناڵ نوێترین دەداتە سەرەتا

        // ڕێگریکردن لە دووبارەبوونەوەی کاتەکان کە دەبێتە هۆی کراشی چارتەکە
        const uniqueData = [];
        const seenTimes = new Set();
        for (const d of formattedData) {
            if (!seenTimes.has(d.time)) {
                seenTimes.add(d.time);
                uniqueData.push(d);
            }
        }
        
        // دڵنیابوونەوە لەوەی کاتەکان بە تەواوی لە بچووکەوە بۆ گەورە ڕیزکراون
        uniqueData.sort((a, b) => a.time - b.time);

        const cleanData = uniqueData.filter(d => 
            Number.isFinite(d.time) && 
            Number.isFinite(d.open) && 
            Number.isFinite(d.high) && 
            Number.isFinite(d.low) && 
            Number.isFinite(d.close) && 
            Number.isFinite(d.volume) &&
            d.high >= d.low &&
            d.high >= d.open && d.high >= d.close &&
            d.low <= d.open && d.low <= d.close
        );

        if (cleanData.length === 0) {
            console.warn("No candle data found for this pool.");
            if (document.getElementById('placeholderText')) {
                document.getElementById('placeholderText').innerText = "داتای مۆمەکان بەتاڵە پاش فلتەرکردن.";
                document.getElementById('placeholderText').style.color = "#ef5350";
                document.getElementById('placeholderText').style.display = "block";
                document.getElementById('searchBtn').innerText = "گەڕان";
                document.getElementById('searchBtn').disabled = false;
            }
            return false;
        }

        try {
            renderChartData(cleanData, isRefresh);
        } catch (renderError) {
            console.error("Render Chart Error:", renderError);
            return false;
        }
        
        // ڕاگرتنی ڵایڤی باینانس ئەگەر هەبوو، چونکە ئەمە دراوی دەرەوەیە
        if (currentWs) {
            currentWs.close();
            currentWs = null;
        }

        // کارپێکردنی نوێکردنەوەی ئۆتۆماتیکی زۆر خێراتر بۆ ئەوەی لایڤ بێت لەگەڵ بازاڕ
        if (!isRefresh) {
            if (geckoRefreshInterval) clearInterval(geckoRefreshInterval);
            geckoRefreshInterval = setInterval(() => {
                window.loadDexChart(network, poolAddress, tokenAddress, true, interval);
            }, 15000); // هەر 15 چرکە جارێک لایڤ نوێ دەبێتەوە
        }

        return true;
    } catch (error) {
        console.error("Error loading DEX data:", error);
        return false;
    }
};

function renderChartData(formattedData, isRefresh = false) {
    window.chartData = formattedData;

    if (priceChart && (!isRefresh || !candlestickSeries || !volumeSeries || !smaSeries || !bbUpperSeries || !rsiSeries || !macdSeries)) {
        document.getElementById('price-chart').innerHTML = '';
        if (document.getElementById('rsi-chart')) document.getElementById('rsi-chart').innerHTML = '';
        if (document.getElementById('macd-chart')) document.getElementById('macd-chart').innerHTML = '';
        priceChart = null;
        rsiChart = null;
        macdChart = null;
        candlestickSeries = null;
        volumeSeries = null;
        smaSeries = null;
        ema50Series = null;
        ema200Series = null;
        vwapSeries = null;
        bbUpperSeries = null;
        bbLowerSeries = null;
        rsiSeries = null;
        histSeries = null;
        macdSeries = null;
        signalSeries = null;
        
        // Clear global price lines so they are recreated on the new timeframe
        window.tpLine = null;
        window.slLine = null;
        window.resLine = null;
        window.supLine = null;
    }

    const isLightMode = document.body.classList.contains('light-mode');
    const bg = isLightMode ? '#ffffff' : '#131722';
    const text = isLightMode ? '#131722' : '#d1d4dc';
    const grid = isLightMode ? '#e0e3eb' : '#2a2e39';

    const chartOptions = {
        layout: { background: { color: bg }, textColor: text },
        grid: { vertLines: { color: grid }, horzLines: { color: grid } },
        timeScale: { borderColor: grid, timeVisible: true },
        watermark: {
            color: isLightMode ? 'rgba(0, 0, 0, 0.04)' : 'rgba(255, 255, 255, 0.04)',
            visible: true,
            text: 'Garany AI',
            fontSize: 72,
            horzAlign: 'center',
            vertAlign: 'center',
        },
        width: document.getElementById('price-chart').clientWidth || 800,
        height: 500
    };

    if (!priceChart) {
        const priceContainer = document.getElementById('price-chart');
        const rsiContainer = document.getElementById('rsi-chart');
        const macdContainer = document.getElementById('macd-chart');
        
        priceChart = LightweightCharts.createChart(priceContainer, chartOptions);
        
        candlestickSeries = priceChart.addCandlestickSeries({
            upColor: '#26a69a', downColor: '#ef5350', borderVisible: false,
            wickUpColor: '#26a69a', wickDownColor: '#ef5350',
            priceFormat: {
                type: 'custom',
                formatter: function(price) {
                    if (price === undefined || price === null || isNaN(price)) return '0.00';
                    if (price >= 1e9) return (price / 1e9).toFixed(2) + 'B';
                    if (price >= 1e6) return (price / 1e6).toFixed(2) + 'M';
                    if (price >= 1e3) return (price / 1e3).toFixed(2) + 'K';
                    if (price > 0 && price < 0.01) return price.toExponential(2);
                    return price.toFixed(2);
                }
            }
        });
        window.candlestickSeries = candlestickSeries;
        
        smaSeries = priceChart.addLineSeries({ color: 'rgba(41, 98, 255, 0.4)', lineWidth: 1, title: 'SMA 20' });
        ema50Series = priceChart.addLineSeries({ color: '#ffeb3b', lineWidth: 2, title: 'EMA 50' });
        ema200Series = priceChart.addLineSeries({ color: '#f44336', lineWidth: 2, title: 'EMA 200' });
        vwapSeries = priceChart.addLineSeries({ color: '#9c27b0', lineWidth: 2, title: 'VWAP', lineStyle: 2 });
        bbUpperSeries = priceChart.addLineSeries({ color: 'rgba(41, 98, 255, 0.3)', lineWidth: 1, title: 'BB Upper', lineStyle: 2 });
        bbLowerSeries = priceChart.addLineSeries({ color: 'rgba(41, 98, 255, 0.3)', lineWidth: 1, title: 'BB Lower', lineStyle: 2 });

        // دروستکردنی لێجێندی دینامیکی (Legend)
        const legend = document.createElement('div');
        legend.id = 'chart-legend';
        legend.style = `position: absolute; left: 12px; top: 12px; z-index: 2; font-size: 13px; font-family: 'Inter', sans-serif; color: ${text}; padding: 10px; border-radius: 8px; background: ${isLightMode ? 'rgba(255,255,255,0.7)' : 'rgba(19,23,34,0.7)'}; backdrop-filter: blur(8px); border: 1px solid rgba(128,128,128,0.2); pointer-events: none;`;
        priceContainer.style.position = 'relative';
        priceContainer.appendChild(legend);
        
        function formatNum(num) {
            if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
            if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
            if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
            if (num > 0 && num < 0.01) return num.toExponential(2);
            return num.toFixed(2);
        }

        priceChart.subscribeCrosshairMove(param => {
            if (param.time) {
                const data = param.seriesData.get(candlestickSeries);
                const vol = param.seriesData.get(volumeSeries);
                if (data) {
                    const oColor = data.open > data.close ? '#ef5350' : '#26a69a';
                    const diff = data.close - data.open;
                    const diffPct = ((diff / data.open) * 100).toFixed(2);
                    legend.innerHTML = `
                        <div style="font-weight: bold; font-size: 15px; margin-bottom: 4px; color: #2962ff;">${window.lastSearchedSymbol || 'Coin'}</div>
                        <div style="display: grid; grid-template-columns: auto auto; gap: 4px 12px;">
                            <span>Open: <span style="color: ${oColor}; font-weight: bold;">${formatNum(data.open)}</span></span>
                            <span>High: <span style="font-weight: bold;">${formatNum(data.high)}</span></span>
                            <span>Low: <span style="font-weight: bold;">${formatNum(data.low)}</span></span>
                            <span>Close: <span style="color: ${oColor}; font-weight: bold;">${formatNum(data.close)}</span> <span style="font-size: 11px;">(${diffPct}%)</span></span>
                        </div>
                    `;
                }
            } else {
                legend.innerHTML = `<div style="font-weight: bold; font-size: 15px; color: #2962ff;">${window.lastSearchedSymbol || 'Coin'}</div><div style="color: gray; margin-top: 4px;">ماوسەکەت بەرەو چارتەکە بڕۆ بۆ بینینی داتا</div>`;
            }
        });
            
            // زیادکردنی هێڵکاری ڤۆلیۆم وەک چینی خوارەوەی چارتی مۆمەکان
            volumeSeries = priceChart.addHistogramSeries({
                color: '#26a69a',
                priceFormat: { type: 'volume' },
                priceScaleId: 'volume_scale', // بەستنەوەی بە پێوەری نرخی تایبەت
            });
            // هێڵی تێکڕای قەبارە (Volume SMA)
            window.volSmaSeries = priceChart.addLineSeries({
                color: 'rgba(255, 152, 0, 0.5)',
                lineWidth: 2,
                priceScaleId: 'volume_scale',
                title: 'Vol SMA',
                crosshairMarkerVisible: false,
            });
            // ڕێکخستنی پێوەری نرخی ڤۆلیۆم بۆ ئەوەی لە خوارەوە بێت
            priceChart.priceScale('volume_scale').applyOptions({
                scaleMargins: { top: 0.8, bottom: 0 }, // 80% بۆشایی لە سەرەوەی بەشی ڤۆلیۆم
            });
            
            rsiChart = LightweightCharts.createChart(rsiContainer, { 
                ...chartOptions, 
                height: 150,
                width: rsiContainer.clientWidth || 800
            });
            rsiSeries = rsiChart.addLineSeries({ color: '#ff9800', lineWidth: 2, title: 'RSI 14' });

            macdChart = LightweightCharts.createChart(macdContainer, { 
                ...chartOptions, 
                height: 150,
                width: macdContainer.clientWidth || 800
            });
            histSeries = macdChart.addHistogramSeries({ color: '#26a69a' });
            macdSeries = macdChart.addLineSeries({ color: '#2962ff', lineWidth: 2, title: 'MACD' });
            signalSeries = macdChart.addLineSeries({ color: '#ff9800', lineWidth: 2, title: 'Signal' });

            // هاوکاتکردنی کاتی هەردوو هێڵکارییەکە
        priceChart.timeScale().subscribeVisibleTimeRangeChange(range => {
            if (range) {
                try {
                    if (rsiChart) rsiChart.timeScale().setVisibleRange(range);
                } catch (e) { /* ignore error during initialization */ }
                
                try {
                    if (macdChart) macdChart.timeScale().setVisibleRange(range);
                } catch (e) { /* ignore error during initialization */ }
            }
        });
        }

        // دڵنیابوونەوە لەوەی قەبارەی هێڵکارییەکە ڕاستە ئەگەر دەفرەکە پێشتر شاراوە بووبێت
        if (!isRefresh) {
            const currentWidth = document.getElementById('price-chart').clientWidth || 800;
            priceChart.resize(currentWidth, 500);
            if (rsiChart) rsiChart.resize(currentWidth, 150);
            if (macdChart) macdChart.resize(currentWidth, 150);
        }

        if (!candlestickSeries) throw new Error("candlestickSeries is undefined");
        
        try {
            // بۆ ئەوەی چارتەکە لایڤ بێت و فلاش نەکات، ڕاستەوخۆ داتاکە دەدەینێ بەبێ سڕینەوەی نیشانەکان
            try { console.log('FIRST CANDLE:', JSON.stringify(formattedData[0])); candlestickSeries.setData(formattedData); } catch(err) { console.error('CANDLE DATA ERR:', JSON.stringify(formattedData[0])); throw err; }
        } catch(e) { throw new Error("candlestickSeries.setData: " + e.message); }

        // تێکردنی داتای ڤۆلیۆم بە ڕەنگکردنی ستوونەکان
        const volumeData = formattedData.map(d => ({
            time: d.time,
            value: d.volume,
            color: d.close >= d.open ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)'
        }));
        if (!volumeSeries) throw new Error("volumeSeries is undefined");
        try {
            volumeSeries.setData(volumeData);
        } catch(e) { throw new Error("volumeSeries.setData: " + e.message); }

        // ئەنجامدانی حیساباتی ئیندیکاتۆرەکان
        const smaData = calculateSMA(formattedData, 20);
        if (!smaSeries) throw new Error("smaSeries is undefined");
        try {
            smaSeries.setData(smaData);
        } catch(e) { throw new Error("smaSeries.setData: " + e.message); }

        const ema50Data = calculateEMA(formattedData, 50, 'close');
        if (ema50Series) {
            try { ema50Series.setData(ema50Data); } catch(e) {}
        }
        const ema200Data = calculateEMA(formattedData, 200, 'close');
        if (ema200Series) {
            try { ema200Series.setData(ema200Data); } catch(e) {}
        }
        const vwapData = calculateVWAP(formattedData);
        if (vwapSeries) {
            try { vwapSeries.setData(vwapData); } catch(e) {}
        }

        // Fibonacci Retracement
        if (candlestickSeries && formattedData.length > 0) {
            const lookback = Math.min(150, formattedData.length);
            let recentHigh = -Infinity;
            let recentLow = Infinity;
            for (let i = formattedData.length - lookback; i < formattedData.length; i++) {
                if (formattedData[i].high > recentHigh) recentHigh = formattedData[i].high;
                if (formattedData[i].low < recentLow) recentLow = formattedData[i].low;
            }
            if (recentHigh !== -Infinity && recentLow !== Infinity) {
                const diff = recentHigh - recentLow;
                const fibLevels = [
                    { level: 0.236, value: recentHigh - diff * 0.236, color: 'rgba(244, 67, 54, 0.5)' },
                    { level: 0.382, value: recentHigh - diff * 0.382, color: 'rgba(76, 175, 80, 0.5)' },
                    { level: 0.5,   value: recentHigh - diff * 0.5,   color: 'rgba(255, 235, 59, 0.5)' },
                    { level: 0.618, value: recentHigh - diff * 0.618, color: 'rgba(33, 150, 243, 0.5)' }
                ];
                
                // Clear previous global fib lines if needed, since we DON'T always recreate candlestickSeries
                if (window.activeFibLines && window.activeFibLines.length > 0) {
                    window.activeFibLines.forEach(line => {
                        try { candlestickSeries.removePriceLine(line); } catch(e) {}
                    });
                }
                window.activeFibLines = [];
                
                fibLevels.forEach(fib => {
                    const line = candlestickSeries.createPriceLine({
                        price: fib.value,
                        color: fib.color,
                        lineWidth: 1,
                        lineStyle: 2,
                        axisLabelVisible: true,
                        title: `Fib ${fib.level}`
                    });
                    window.activeFibLines.push(line);
                });
            }
        }

        const bbData = calculateBollingerBands(formattedData, 20, 2);
        if (!bbUpperSeries) throw new Error("bbUpperSeries is undefined");
        if (!bbLowerSeries) throw new Error("bbLowerSeries is undefined");
        try {
            bbUpperSeries.setData(bbData.upper);
            bbLowerSeries.setData(bbData.lower);
        } catch(e) { throw new Error("bbSeries.setData: " + e.message); }

        const rsiData = calculateRSI(formattedData, 14);
        if (!rsiSeries) throw new Error("rsiSeries is undefined");
        try {
            rsiSeries.setData(rsiData);
        } catch(e) { throw new Error("rsiSeries.setData: " + e.message); }

        const macdData = calculateMACD(formattedData);
        if (!histSeries) throw new Error("histSeries is undefined");
        if (!macdSeries) throw new Error("macdSeries is undefined");
        if (!signalSeries) throw new Error("signalSeries is undefined");
        histSeries.setData(macdData.histogram);
        macdSeries.setData(macdData.macdLine);
        signalSeries.setData(macdData.signalLine);

        // داتای Volume SMA
        if (window.volSmaSeries) {
            // حیسابکردنی Volume SMA بە شێوازێکی خێرا
            const volSmaData = [];
            let volSum = 0;
            for (let i = 0; i < formattedData.length; i++) {
                volSum += formattedData[i].volume;
                if (i >= 20) {
                    volSum -= formattedData[i - 20].volume;
                    volSmaData.push({ time: formattedData[i].time, value: volSum / 20 });
                } else if (i === 19) {
                    volSmaData.push({ time: formattedData[i].time, value: volSum / 20 });
                }
            }
            window.volSmaSeries.setData(volSmaData);
        }

        // ئەگەر تەنها نوێکردنەوەیە، با زوومی بەکارهێنەر تێکنەچێت
        if (!isRefresh) {
            priceChart.timeScale().fitContent();
        }

        // ناردنی ئیندیکاتۆرەکان بۆ سیگناڵەکان بۆ ئەوەی دووبارە حیساب نەکرێنەوە و خێرا بێت
        if (window.applyMemeSignalsToChart) {
            window.applyMemeSignalsToChart(window.currentSecurityData || null, rsiData, bbData, macdData);
        }
}

window.updateChartTheme = function(isLightMode) {
    if (!priceChart) return;
    const bg = isLightMode ? '#ffffff' : '#131722';
    const text = isLightMode ? '#131722' : '#d1d4dc';
    const grid = isLightMode ? '#e0e3eb' : '#2a2e39';
    
    const themeOptions = {
        layout: { background: { color: bg }, textColor: text },
        grid: { vertLines: { color: grid }, horzLines: { color: grid } },
        timeScale: { borderColor: grid }
    };

    priceChart.applyOptions(themeOptions);
    if (rsiChart) rsiChart.applyOptions(themeOptions);
    if (macdChart) macdChart.applyOptions(themeOptions);
};

function calculateVWAP(data) {
    const vwap = [];
    let cumVol = 0;
    let cumVolTypPrice = 0;
    for (let i = 0; i < data.length; i++) {
        const typicalPrice = (data[i].high + data[i].low + data[i].close) / 3;
        cumVol += data[i].volume;
        cumVolTypPrice += data[i].volume * typicalPrice;
        if (cumVol > 0) {
            vwap.push({ time: data[i].time, value: cumVolTypPrice / cumVol });
        }
    }
    return vwap;
}

function calculateSMA(data, period) {
    const sma = [];
    for (let i = period - 1; i < data.length; i++) {
        const sum = data.slice(i - period + 1, i + 1).reduce((acc, curr) => acc + curr.close, 0);
        sma.push({ time: data[i].time, value: sum / period });
    }
    return sma;
}

function calculateRSI(data, period) {
    const rsiData = [];
    const gains = [];
    const losses = [];
    for (let i = 1; i < data.length; i++) {
        const diff = data[i].close - data[i - 1].close;
        gains.push(Math.max(0, diff));
        losses.push(Math.max(0, -diff));
    }
    let avgGain = gains.slice(0, period).reduce((a, b) => a + b) / period;
    let avgLoss = losses.slice(0, period).reduce((a, b) => a + b) / period;
    for (let i = period; i < data.length; i++) {
        const rs = avgGain / (avgLoss || 1);
        rsiData.push({ time: data[i].time, value: 100 - (100 / (1 + rs)) });
        avgGain = ((avgGain * (period - 1)) + gains[i]) / period;
        avgLoss = ((avgLoss * (period - 1)) + losses[i]) / period;
    }
    return rsiData;
}

function calculateBollingerBands(data, period, multiplier) {
    const bbData = { upper: [], lower: [] };
    for (let i = period - 1; i < data.length; i++) {
        const slice = data.slice(i - period + 1, i + 1);
        const sum = slice.reduce((acc, curr) => acc + curr.close, 0);
        const sma = sum / period;
        const variance = slice.reduce((acc, curr) => acc + Math.pow(curr.close - sma, 2), 0) / period;
        const stdDev = Math.sqrt(variance);
        
        bbData.upper.push({ time: data[i].time, value: sma + (stdDev * multiplier) });
        bbData.lower.push({ time: data[i].time, value: sma - (stdDev * multiplier) });
    }
    return bbData;
}

function calculateEMA(data, period, key = 'close') {
    const k = 2 / (period + 1);
    const emaData = [];
    let ema = data[0][key];
    emaData.push({ time: data[0].time, value: ema });
    for (let i = 1; i < data.length; i++) {
        ema = (data[i][key] - ema) * k + ema;
        emaData.push({ time: data[i].time, value: ema });
    }
    return emaData;
}

function calculateMACD(data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    const fastEma = calculateEMA(data, fastPeriod, 'close');
    const slowEma = calculateEMA(data, slowPeriod, 'close');
    const macdLine = [];
    for (let i = 0; i < data.length; i++) {
        macdLine.push({ time: data[i].time, value: fastEma[i].value - slowEma[i].value });
    }
    const signalLine = calculateEMA(macdLine, signalPeriod, 'value');
    const histogram = [];
    for (let i = 0; i < data.length; i++) {
        const histValue = macdLine[i].value - signalLine[i].value;
        let color = histValue >= 0 ? '#26a69a' : '#ef5350'; // ڕەنگی بنەڕەتی
        if (i > 0) {
            const prevHist = histogram[i-1].value;
            if (histValue >= 0) color = histValue >= prevHist ? '#26a69a' : '#b2dfdb'; // سەوزی تۆخ/کاڵ
            else color = histValue <= prevHist ? '#ef5350' : '#ef9a9a'; // سووری تۆخ/کاڵ
        }
        histogram.push({ time: data[i].time, value: histValue, color: color });
    }
    return { macdLine, signalLine, histogram };
}

// بارکردنی سەرەتایی کاتێک پەڕەکە دەبێتەوە
document.addEventListener('DOMContentLoaded', () => {
    // چاوەڕوانی گەڕانی بەکارهێنەر دەکەین
});

// =========================================================================
// --- ئەلگۆریتمی پێچەوانەبوونەوەی خێرای میمکۆین (3-Candle Reversal Algorithm) ---
// =========================================================================

window.generateMemeReversalSignals = function(data, securityData, rsiData, bbData, macdData) {
    let markers = [];

    // فلتەری ئاسایش (پاراستنی فەرش): ئەگەر دراوەکە ساختە بێت سیگناڵی درۆینە نادات
    if (securityData) {
        const isHoneypot = securityData.is_honeypot === "1" || securityData.is_honeypot === true;
        if (isHoneypot) return [];
    }
    
    if (!data || data.length < 15) return [];

    const interval = window.currentInterval || '1h';
    const isHigherTimeframe = ['1h', '2h', '4h', '1d'].includes(interval);
    
    // بەکارهێنانی داتای پێشوەخت حیسابکراو بۆ خێرایی
    const rsiMap = rsiData ? new Map(rsiData.map(d => [d.time, d.value])) : new Map();
    const bbMap = bbData ? new Map() : new Map();
    if (bbData) {
        for (let i = 0; i < bbData.lower.length; i++) {
            bbMap.set(bbData.lower[i].time, { lower: bbData.lower[i].value, upper: bbData.upper[i].value });
        }
    }
    const macdMap = macdData ? new Map(macdData.histogram.map(d => [d.time, d.value])) : new Map();

    // حیسابکردنی Rolling Volume بۆ ئەوەی لوپی ناوەکی نەکەین (خێراترە)
    const lookback = isHigherTimeframe ? 5 : 3;
    let currentVolSum = 0;
    const avgVolMap = new Map();
    for (let i = 0; i < data.length; i++) {
        currentVolSum += data[i].volume;
        if (i >= lookback) {
            currentVolSum -= data[i - lookback].volume;
            avgVolMap.set(data[i].time, currentVolSum / lookback);
        }
    }

    for (let i = 10; i < data.length - 1; i++) {
        const current = data[i];
        const next = data[i + 1];
        const prev = data[i - 1];
        
        const currentRsi = rsiMap.get(current.time);
        const prevRsi = rsiMap.get(prev.time);
        const currentBb = bbMap.get(current.time);
        const currentMacdHist = macdMap.get(current.time);
        const prevMacdHist = macdMap.get(prev.time);
        
        // فلتەری توندی بۆلینجەر
        let isSqueezed = false;
        if (currentBb) {
            const bbWidth = (currentBb.upper - currentBb.lower) / currentBb.lower;
            if (bbWidth < 0.02) isSqueezed = true;
        }
        
        if (isSqueezed && !isHigherTimeframe) continue; 

        const avgVol = avgVolMap.get(prev.time) || current.volume; // بەکارهێنانی قەبارەی پێشتر بۆ تێکڕا
        const volumeMultiplier = isHigherTimeframe ? 2.0 : 1.5;
        const hasVolumeSpike = current.volume >= (avgVol * volumeMultiplier);

        if (!hasVolumeSpike) continue; 

        // بڕینی بەشێک لە مۆمەکان بۆ ناسینەوەی شێوە (Patterns) - یەکخستنی تایبەتمەندییە فەرامۆشکراوەکە
        const sliceForPattern = data.slice(Math.max(0, i - 10), i + 1);
        let patterns = { hasHammer: false, hasShootingStar: false, hasBullishEngulfing: false, hasBearishEngulfing: false };
        if (window.detectCandlePatterns && sliceForPattern.length >= 7) {
            patterns = window.detectCandlePatterns(sliceForPattern, currentRsi, prevRsi);
        }

        const currentBody = Math.abs(current.close - current.open);
        const lowerWick = Math.min(current.open, current.close) - current.low;
        const upperWick = current.high - Math.max(current.open, current.close);
        const nextBody = Math.abs(next.close - next.open);

        // ====================================================
        // 1. خوارەوەی ناوخۆیی و سیستەمی خاڵدان (AI Scoring BUY)
        // ====================================================
        let isLocalBottom = current.low <= prev.low && current.low <= data[i-2].low && current.low <= data[i-3].low;
        
        let buyScore = 0;
        
        // پێوەرەکانی خاڵدان
        // 1. RSI Score (Max 30)
        if (currentRsi !== undefined) {
            if (currentRsi < 30) buyScore += 30;
            else if (currentRsi < 40) buyScore += 15;
            
            // Bullish Divergence (+20 points bonus)
            if (currentRsi < 45 && prevRsi !== undefined && currentRsi > prevRsi && current.low < prev.low) {
                buyScore += 20;
            }
        }
        
        // 2. MACD Score (Max 30)
        if (currentMacdHist !== undefined && prevMacdHist !== undefined) {
            if (currentMacdHist > prevMacdHist && currentMacdHist < 0) buyScore += 30; // Histogram crossing up below 0
            else if (currentMacdHist > prevMacdHist) buyScore += 15; // Histogram increasing
        }
        
        // 3. Price Action / Support / Patterns (Max 45)
        if (currentBb !== undefined && current.low <= currentBb.lower * 1.02) buyScore += 20; // Near BB Support
        if (patterns.hasHammer || patterns.hasBullishEngulfing) buyScore += 25; // Candlestick Patterns
        
        // 4. Volume (Max 15)
        if (hasVolumeSpike) buyScore += 15;
        
        const isCurrentGreen = current.close > current.open; 
        const isNextGreen = next.close > next.open; 
        const hasLowerRejection = isHigherTimeframe ? (lowerWick >= currentBody * 0.5) : true;
        
        if (isLocalBottom && isCurrentGreen && isNextGreen && hasLowerRejection) {
            if (buyScore >= 70) {
                markers.push({
                    time: current.time,
                    position: 'belowBar',
                    color: '#26a69a',
                    shape: 'arrowUp',
                    text: `🚀 BUY (${buyScore})`,
                    size: buyScore >= 90 ? 2 : 1
                });
                continue; 
            }
        }

        // ====================================================
        // 2. لوتکەی ناوخۆیی (SELL THE PEAK)
        // ====================================================
        let isLocalTop = current.high >= prev.high && current.high >= data[i-2].high && current.high >= data[i-3].high;

        const isCurrentRed = current.close < current.open; 
        const isNextRed = next.close < next.open;          
        
        const hasUpperRejection = isHigherTimeframe ? (upperWick >= currentBody * 0.8) : true;
        const hasStrongConfirmationSell = isHigherTimeframe ? (next.close < current.open || nextBody >= currentBody * 0.5) : true;
        
        let sellIndicatorsValid = true;
        if (isHigherTimeframe && currentRsi !== undefined && currentBb !== undefined) {
            sellIndicatorsValid = (currentRsi > 55) && (current.high >= currentBb.upper * 0.99);
        } else if (!isHigherTimeframe && currentMacdHist !== undefined && prevMacdHist !== undefined) {
            sellIndicatorsValid = currentMacdHist < prevMacdHist;
        }

        const isSuperSell = patterns.hasShootingStar || patterns.hasBearishEngulfing;

        if (isLocalTop && isCurrentRed && isNextRed && hasUpperRejection && hasStrongConfirmationSell && sellIndicatorsValid) {
            markers.push({
                time: current.time,
                position: 'aboveBar',
                color: '#ef5350',
                shape: 'arrowDown',
                text: isSuperSell ? '💀 SUPER SELL' : (isHigherTimeframe ? '🔴 STRONG SELL' : '🚨 MEME PEAK'),
                size: isSuperSell ? 2 : 1
            });
        }
    }

    return markers;
};

// ئاشکراکردنی جوڵەی نهەنگەکان لەسەر بنەمای بەرزبوونەوەی زەبەلاحی قەبارە (Whale Detection)
window.generateWhaleMarkers = function(data) {
    const markers = [];
    if (!data || data.length < 25) return markers;

    // حیسابکردنی Rolling Volume بۆ خێرایی و نەکردنی لوپی دووبارە
    let volSum = 0;
    const avgVolMap = new Map();
    for (let i = 0; i < data.length; i++) {
        volSum += data[i].volume;
        if (i >= 20) {
            volSum -= data[i - 20].volume;
            avgVolMap.set(data[i].time, volSum / 20);
        }
    }

    for (let i = 20; i < data.length; i++) {
        const current = data[i];
        const prev = data[i-1];
        const avgVol = avgVolMap.get(prev.time) || current.volume;

        // ئەگەر قەبارە زۆر بەرز بوو (٤ هێندەی تێکڕا)
        if (current.volume > (avgVol * 4) && current.volume > 0) {
            const isGreen = current.close > current.open;
            const isRed = current.close < current.open;
            
            if (isGreen) {
                markers.push({
                    time: current.time,
                    position: 'belowBar',
                    color: '#00c853',
                    shape: 'arrowUp',
                    text: '🐳 BUY',
                    size: 2
                });
            } else if (isRed) {
                markers.push({
                    time: current.time,
                    position: 'aboveBar',
                    color: '#ff5252',
                    shape: 'arrowDown',
                    text: '🐳 SELL',
                    size: 2
                });
            }
        }
    }
    return markers;
};

// ==========================================
// سیستەمی ئاگادارکردنەوەی دەنگی و بینراو (Smart Alerts)
// ==========================================
window.playAlertSound = function(type) {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        if (type === 'success') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(523.25, ctx.currentTime);
            osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
            osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2);
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.5);
        } else if (type === 'danger') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(300, ctx.currentTime);
            osc.frequency.setValueAtTime(200, ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.5);
        } else {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(600, ctx.currentTime);
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.3);
        }
    } catch(e) { console.error(e); }
};

window.showToastAlert = function(message, type = 'info') {
    let container = document.getElementById('garany-toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'garany-toast-container';
        container.style = 'position: fixed; top: 20px; right: 20px; z-index: 9999; display: flex; flex-direction: column; gap: 10px;';
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    const bgColor = type === 'success' ? '#00e676' : type === 'danger' ? '#ff1744' : '#2962ff';
    toast.style = `background: ${bgColor}; color: white; padding: 15px 20px; border-radius: 8px; font-weight: bold; font-family: 'Inter', sans-serif; box-shadow: 0 4px 12px rgba(0,0,0,0.3); transform: translateX(100%); transition: transform 0.3s ease-out; display: flex; align-items: center; gap: 10px; font-size: 14px;`;
    
    const icon = type === 'success' ? '✅' : type === 'danger' ? '🚨' : 'ℹ️';
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);
    
    setTimeout(() => { toast.style.transform = 'translateX(0)'; }, 10);
    window.playAlertSound(type);
    
    setTimeout(() => {
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
};
// ==========================================

// جێبەجێکردنی ئەلگۆریتمەکە و نەخشەسازی لەسەر چارتەکە (Plotting)
window.applyMemeSignalsToChart = function(securityData, rsiData, bbData, macdData) {
    if (!window.chartData || !window.candlestickSeries) return;

    const data = window.chartData;
    
    // ئەگەر ئیندیکاتۆرەکان نەدرابوون، لێرە حیسابیان دەکەین بۆ ئەوەی ئەلگۆریتمەکە بە دروستی کار بکات
    if (!rsiData && window.calculateRSI) rsiData = window.calculateRSI(data, 14);
    if (!bbData && window.calculateBollingerBands) bbData = window.calculateBollingerBands(data, 20, 2);
    if (!macdData && window.calculateMACD) macdData = window.calculateMACD(data);
    
    // وەرگرتنی ڕیزبەندی نیشانەکان (Markers Array) بە پێی ئەلگۆریتمە نوێیەکە
    const newMarkers = window.generateMemeReversalSignals(data, securityData, rsiData, bbData, macdData);
    
    // وەرگرتنی نیشانەکانی نهەنگ
    const whaleMarkers = window.generateWhaleMarkers(data);

    // پاراستنی هەر نیشانەیەکی پێشوو (وەک خاڵی کڕینی پۆرتفۆلیۆ) ئەگەر هەبوو
    const existingMarkers = window.customTradeMarkers || []; 
    
    // کۆکردنەوە و ڕیزکردنی کاتی بۆ ئەوەی بەیەکەوە پیشان بدرێن
    const allMarkers = [...existingMarkers, ...newMarkers, ...whaleMarkers].sort((a, b) => a.time - b.time);
    
    window.candlestickSeries.setMarkers(allMarkers);

    // --- دانانی هێڵەکانی Take Profit و Stop Loss ---
    // دانانی هێڵەکان لەسەر بنەمای نرخی ئێستا (کۆتا مۆم) نەک سیگناڵێکی کۆن
    const currentCandle = data[data.length - 1];
    if (currentCandle) {
        const entryPrice = currentCandle.close;
        // دۆزینەوەی تێکڕای جووڵەی ڕاستەقینەی بازاڕ (ATR) بۆ ئەوەی هێڵەکان تێکنەچن
        let sumTR = 0;
        let count = 0;
        let lookbackRange = Math.max(1, data.length - 14);
        for (let i = lookbackRange; i < data.length; i++) {
            const high = data[i].high;
            const low = data[i].low;
            const prevClose = data[i-1].close;
            const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
            sumTR += tr;
            count++;
        }
        
        // دیاریکردنی ئامانجەکان بە پشت بەستن بە جووڵەی بازاڕ (Volatility)
        const atrEstimate = count > 0 ? (sumTR / count) : (entryPrice * 0.05);
        const targetTP = entryPrice + (atrEstimate * 2.0); // قازانجە پێشبینیکراوەکە
        const targetSL = Math.max(0, entryPrice - (atrEstimate * 1.5)); // زەرەرە ڕێگەپێدراوەکە

        window.tpTarget = targetTP;
        window.slTarget = targetSL;

        // کێشانی هێڵی قازانج (Take Profit) بە شێوازی نەرم بێ ئەوەی فلاش بکات
        if (window.tpLine) {
            window.tpLine.applyOptions({ price: targetTP });
        } else {
            window.tpLine = window.candlestickSeries.createPriceLine({
                price: targetTP,
                color: '#00e676', // سەوزی کڕاوە
                lineWidth: 2,
                lineStyle: 1, // Dashed
                axisLabelVisible: true,
                title: 'TP قازانج',
            });
        }

        // کێشانی هێڵی زەرەر (Stop Loss)
        if (window.slLine) {
            window.slLine.applyOptions({ price: targetSL });
        } else {
            window.slLine = window.candlestickSeries.createPriceLine({
                price: targetSL,
                color: '#ff1744', // سووری کڕاوە
                lineWidth: 2,
                lineStyle: 1, // Dashed
                axisLabelVisible: true,
                title: 'SL زەرەر',
            });
        }
    }

    // --- دانانی هێڵەکانی پاڵپشتی و بەرگری (Support & Resistance) ---
    // دۆزینەوەی بەرزترین و نزمترین نرخی کۆتا 100 مۆم
    if (data.length > 30) {
        let maxHigh = data[data.length - 1].high;
        let minLow = data[data.length - 1].low;
        const lookback = Math.min(data.length, 100);
        for (let i = data.length - lookback; i < data.length; i++) {
            if (data[i].high > maxHigh) maxHigh = data[i].high;
            if (data[i].low < minLow) minLow = data[i].low;
        }

        // هێڵی بەرگری (Resistance) لە بەرزترین خاڵ
        window.resTarget = maxHigh;
        if (window.resLine) {
            window.resLine.applyOptions({ price: maxHigh });
        } else {
            window.resLine = window.candlestickSeries.createPriceLine({
                price: maxHigh,
                color: 'rgba(41, 98, 255, 0.6)', // شین
                lineWidth: 2,
                lineStyle: 2, // Dotted
                axisLabelVisible: true,
                title: 'بەرگری',
            });
        }

        // هێڵی پاڵپشتی (Support) لە نزمترین خاڵ
        window.supTarget = minLow;
        if (window.supLine) {
            window.supLine.applyOptions({ price: minLow });
        } else {
            window.supLine = window.candlestickSeries.createPriceLine({
                price: minLow,
                color: 'rgba(255, 152, 0, 0.6)', // پرتەقاڵی
                lineWidth: 2,
                lineStyle: 2, // Dotted
                axisLabelVisible: true,
                title: 'پاڵپشتی',
            });
        }
    }

    // --- سیستەمی ئاگادارکردنەوەی ڕاستەوخۆ (Real-time Alerts) ---
    if (data.length > 0) {
        const lastCandle = data[data.length - 1];
        
        // 1. ئاگادارکردنەوەی نەهەنگەکان
        const latestWhale = whaleMarkers.find(m => m.time === lastCandle.time);
        if (latestWhale) {
            if (window.lastAlertedWhaleTime !== latestWhale.time) {
                window.lastAlertedWhaleTime = latestWhale.time;
                const isBuy = latestWhale.shape === 'arrowUp';
                window.showToastAlert(
                    isBuy ? `نەهەنگێکی گەورە دراوەکەی کڕی!` : `نەهەنگێکی گەورە دراوەکەی فرۆشت!`,
                    isBuy ? 'success' : 'danger'
                );
            }
        }
        
        // 2. ئاگادارکردنەوەی بەرکەوتنی هێڵەکان (TP / SL / Res / Sup)
        if (window.tpTarget && lastCandle.high >= window.tpTarget) {
            if (window.lastAlertedTPTime !== lastCandle.time) {
                window.lastAlertedTPTime = lastCandle.time;
                window.showToastAlert(`ئامانجی قازانج (TP) پێکرا! کاتی فرۆشتنە و وەرگرتنی قازانجە.`, 'success');
            }
        }
        else if (window.slTarget && lastCandle.low <= window.slTarget) {
            if (window.lastAlertedSLTime !== lastCandle.time) {
                window.lastAlertedSLTime = lastCandle.time;
                window.showToastAlert(`هێڵی زەرەر (SL) پێکرا! دراوەکە دابەزینی زۆری کردووە.`, 'danger');
            }
        }
        else if (window.resTarget && lastCandle.high >= window.resTarget && lastCandle.close < window.resTarget) {
            if (window.lastAlertedResTime !== lastCandle.time) {
                window.lastAlertedResTime = lastCandle.time;
                window.showToastAlert(`نرخەکە گەیشتە هێڵی بەرگری (سەقف)! لێرەدا قورسە بەرزبێتەوە.`, 'info');
            }
        }
        else if (window.supTarget && lastCandle.low <= window.supTarget && lastCandle.close > window.supTarget) {
            if (window.lastAlertedSupTime !== lastCandle.time) {
                window.lastAlertedSupTime = lastCandle.time;
                window.showToastAlert(`نرخەکە گەیشتە هێڵی پاڵپشتی (زەوی)! ئەگەری بەرزبوونەوەی هەیە.`, 'info');
            }
        }
    }
};

// ڕێکخستنەوەی قەبارەی چارتەکان لە کاتی گۆڕانی قەبارەی پەنجەرە (شاشە)
window.addEventListener('resize', () => {
    if (priceChart) {
        const chartContainer = document.getElementById('mainChartContainer');
        const isFullscreen = document.fullscreenElement === chartContainer || 
                             document.webkitFullscreenElement === chartContainer ||
                             document.mozFullScreenElement === chartContainer ||
                             document.msFullscreenElement === chartContainer;
                             
        const currentWidth = document.getElementById('price-chart').clientWidth || 800;
        
        let priceHeight = 500;
        let indicatorHeight = 150;
        
        if (isFullscreen) {
            const availableHeight = window.innerHeight - 80; // Leave space for buttons
            priceHeight = availableHeight * 0.65;
            indicatorHeight = availableHeight * 0.17;
        }

        priceChart.resize(currentWidth, priceHeight);
        if (rsiChart) rsiChart.resize(currentWidth, indicatorHeight);
        if (macdChart) macdChart.resize(currentWidth, indicatorHeight);
    }
});

// دڵنیابوونەوە لە ڕێکخستنی قەبارە کاتێک شاشە گەورە دەکرێت یان بچووک دەکرێتەوە
document.addEventListener('fullscreenchange', () => {
    window.dispatchEvent(new Event('resize'));
});
document.addEventListener('webkitfullscreenchange', () => {
    window.dispatchEvent(new Event('resize'));
});

// Advanced Candlestick Pattern Detection (دۆزینەوەی شێوەی مۆمەکان)
window.detectCandlePatterns = function(candles, currentRsi = 50, prevRsi = 50) {
    if (!candles || candles.length < 7) return { hasHammer: false, hasShootingStar: false, hasBullishEngulfing: false, hasBearishEngulfing: false };
    
    const curr = candles[candles.length - 1]; 
    const prev = candles[candles.length - 2];
    
    // حیسابکردنی تێکڕای قەبارەی مامەڵەی ٥ مۆمی پێشوو بۆ دڵنیابوونەوە لە بوونی هێز
    let sumVol = 0;
    for (let i = 2; i <= 6; i++) {
        if (candles[candles.length - i]) {
            sumVol += candles[candles.length - i].volume;
        }
    }
    const avgVol = sumVol / 5;

    // مەرجەکانی چەکوش (Hammer)
    const isHammer = (candle, rsiValue) => {
        const bodyLength = Math.abs(candle.close - candle.open);
        const lowerWick = Math.min(candle.open, candle.close) - candle.low;
        const upperWick = candle.high - Math.max(candle.open, candle.close);
        const totalLength = candle.high - candle.low;
        if (totalLength === 0) return false;
        
        // مەرجەکان: کلکی خوارەوە درێژ بێت، کلکی سەرەوە کورت بێت، قەبارە بەرز بێت، وە RSI لە خوار ٤٥ بێت (واتە بازاڕ دابەزیوە)
        const shapeValid = lowerWick >= 1.5 * bodyLength && upperWick <= totalLength * 0.25 && bodyLength > 0;
        const contextValid = candle.volume >= avgVol * 1.2 && rsiValue < 45;
        return shapeValid && contextValid;
    };

    // مەرجەکانی ئەستێرەی کشاو (Shooting Star)
    const isShootingStar = (candle, rsiValue) => {
        const bodyLength = Math.abs(candle.close - candle.open);
        const lowerWick = Math.min(candle.open, candle.close) - candle.low;
        const upperWick = candle.high - Math.max(candle.open, candle.close);
        const totalLength = candle.high - candle.low;
        if (totalLength === 0) return false;
        
        // مەرجەکان: کلکی سەرەوە درێژ بێت، قەبارە بەرز بێت، وە RSI لە سەرووی ٥٥ بێت
        const shapeValid = upperWick >= 1.5 * bodyLength && lowerWick <= totalLength * 0.25 && bodyLength > 0;
        const contextValid = candle.volume >= avgVol * 1.2 && rsiValue > 55;
        return shapeValid && contextValid;
    };

    // قوتدانی سەوز (Bullish Engulfing)
    const isBullishEngulfing = (prev, curr, rsiValue) => {
        const prevIsRed = prev.close < prev.open;
        const currIsGreen = curr.close > curr.open;
        const shapeValid = prevIsRed && currIsGreen && curr.close >= prev.open && curr.open <= prev.close;
        const contextValid = curr.volume >= avgVol * 1.2 && rsiValue < 45;
        return shapeValid && contextValid;
    };

    // قوتدانی سوور (Bearish Engulfing)
    const isBearishEngulfing = (prev, curr, rsiValue) => {
        const prevIsGreen = prev.close > prev.open;
        const currIsRed = curr.close < curr.open;
        const shapeValid = prevIsGreen && currIsRed && curr.close <= prev.open && curr.open >= prev.close;
        const contextValid = curr.volume >= avgVol * 1.2 && rsiValue > 55;
        return shapeValid && contextValid;
    };

    return {
        hasHammer: isHammer(curr, currentRsi) || isHammer(prev, prevRsi),
        hasShootingStar: isShootingStar(curr, currentRsi) || isShootingStar(prev, prevRsi),
        hasBullishEngulfing: isBullishEngulfing(prev, curr, currentRsi),
        hasBearishEngulfing: isBearishEngulfing(prev, curr, currentRsi)
    };
};
