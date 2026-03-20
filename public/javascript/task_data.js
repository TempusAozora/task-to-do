google.charts.load('current', {'packages':['corechart']});
google.charts.setOnLoadCallback(drawChart);

let chart;
let task_data = {};
const hour = 3600

let current_data;
let current_uuid
let date_span = 7
const MS_PER_DAY = 1000 * 60 * 60 * 24;


window.task_data.forEach(td => {
    let day = new Date(td.date);
    day.setHours(0,0,0,0);
    task_data[td.uuid] = task_data[td.uuid] || {}
    task_data[td.uuid][day.toISOString()] = td.time
});

const default_options = {
    title: 'Click a task to view stats.',
    titleTextStyle: {color: '#ccc', fontSize: 30},
    legend: { position: 'top', textStyle: {color: '#ccc' } },
    backgroundColor: { fill:'transparent' },
    hAxis: {
        textStyle: {color: '#ccc'},
        format: 'MMM dd, yyyy',
        // minorGridlines: {color: 'transparent'}
    },
    vAxis: {
        textStyle: {color: '#ccc'},
        minValue:0, maxValue:86400 / hour,
        minorGridlines: {color: 'transparent'}
    },
    colors: ['#ccc'],
    animation: {
        duration: 500,
        easing: 'out',
    }
};

function drawChart() {
    current_data = [
        ['Hours', 'Hours'],
        [new Date(), 0]
    ]

    var data = google.visualization.arrayToDataTable(current_data);
    chart = new google.visualization.ColumnChart(document.getElementById('column_chart'));
    chart.draw(data, default_options);
}

function change_span(amt) {
    if (date_span === amt) return
    date_span = amt

    refreshData()
}

function dateDiffInDays(a, b) {
  const utc1 = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utc2 = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());

  return Math.floor((utc2 - utc1) / MS_PER_DAY);
}

function refreshData(selected_uuid) {
    let array_data = [];
    if (selected_uuid && selected_uuid === current_uuid) return
    const uuid = selected_uuid || current_uuid
    
    array_data = Object.entries(task_data[uuid])
    array_data.map(v => {
        v[0] = new Date(v[0]);
        v[1] = v[1]/hour;
    })
    array_data.sort(function(a,b){
        return b[0] - a[0];
    });

    const span = date_span !== -1? 
        date_span : 
        1 + dateDiffInDays(array_data[array_data.length-1][0], new Date())
    const avg = Math.floor(array_data.reduce((s, sub) => s + sub[1], 0) / span * 100)/100;
    array_data.splice(0,0, [{type: 'date', label: 'Date'}, "Hours"])

    for (let i = 0; i < span; i++) {
        let day = new Date();
        day.setHours(0,0,0,0)
        day.setDate(day.getDate() - i);

        const day_format = day.toISOString()
        if (!task_data[uuid][day_format]) {
            array_data.push([day, 0])
        }
    }

    let data = google.visualization.arrayToDataTable(array_data);
    let options = JSON.parse(JSON.stringify(default_options));
    options.title = task_dictionary[uuid].name.textContent
    
    chart.draw(data, options);

    current_uuid = uuid;

    refreshTaskData(uuid, avg)
}

function refreshTaskData(uuid, avg) {
    const taskData = task_dictionary[uuid]
    document.getElementById("task-data-name").textContent = taskData.name.textContent
    document.getElementById("task-data-description").textContent = taskData.description.textContent

    let span_string = "Custom";
    switch (date_span) {
        case 7:
           span_string = "7d"
            break;
        case 30:
            span_string = "1m"
            break;
        case 365:
            span_string = "1y"
            break;
        case 0:
            span_string = "All time"
            break;
        default:
            break;
    }

    document.getElementById("avg-time").textContent = `Average time (${span_string}): ${avg} hour/s`
}