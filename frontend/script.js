let data = null;

async function loadData() {
    // temporary sample data (later from C++)
 
    const res = await fetch('../output.json');
    data = await res.json();
    drawATMs();
}


function drawATMs() {
    const canvas = document.getElementById("map");
    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    data.atms.forEach(atm => {

        // ✅ SCALE coordinates
        let x = (atm.x / 100) * canvas.width;
        let y = (atm.y / 100) * canvas.height;

        ctx.beginPath();
        ctx.arc(x, y, 6, 0, 2 * Math.PI);

        if (atm.urgency > 70)
            ctx.fillStyle = "red";
        else if (atm.urgency > 40)
            ctx.fillStyle = "orange";
        else
            ctx.fillStyle = "green";

        ctx.fill();

        // save scaled position
        atm.drawX = x;
        atm.drawY = y;
    });

}

function runAlgorithm() {
    drawATMs();
    drawRoute();
}

function drawRoute() {
    const canvas = document.getElementById("map");
    const ctx = canvas.getContext("2d");

    ctx.strokeStyle = "blue";
    ctx.lineWidth = 2;

    for (let i = 0; i < data.route.length - 1; i++) {
        const a = data.atms.find(x => x.id === data.route[i]);
        const b = data.atms.find(x => x.id === data.route[i+1]);

        ctx.beginPath();
        ctx.moveTo(a.drawX, a.drawY);
        ctx.lineTo(b.drawX, b.drawY);
        ctx.stroke();
    }
}