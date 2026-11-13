// Rust: average marks of a class
struct Student {
    name: String,
    marks: u32,
}

fn average(students: &[Student]) -> f64 {
    let total: u32 = students.iter().map(|s| s.marks).sum();
    total as f64 / students.len() as f64
}

fn main() {
    let class = vec![
        Student { name: String::from("Asha"), marks: 88 },
        Student { name: String::from("Ravi"), marks: 74 },
    ];
    for s in &class {
        println!("{}: {}", s.name, s.marks);
    }
    println!("Average = {:.1}", average(&class));
}
