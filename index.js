const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const mysql = require("mysql2");
const bcrypt = require("bcrypt");
const path = require("path");
const PORT = 3018;
const methodOverride = require("method-override");
const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
const app = express();

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      req.session.message = "Maximum size is 5MB.";
    } else {
      req.session.message = err.message;
    }
    return res.redirect("back");
  } else if (err) {
    req.session.message = "error";
    return res.redirect("back");
  }
  next();
});

const dbConfig = {
  port: 3306,
  host: "localhost",
  user: "root",
  password: "starsinthesky9?", 
  database: "hospital", 
};
const connection = mysql.createConnection(dbConfig);

connection.connect((err) => {
  if (err) {
    console.error("db connection error:", err);
    process.exit(1); 
  }
  console.log("success connect to db");
});

app.use(express.static(path.join(__dirname, "public"))); 
app.use(bodyParser.urlencoded({ extended: true })); 
app.use(
  session({
    secret: "Marc and Carlos", 
    resave: false,
    saveUninitialized: true,
  })
);
app.use(methodOverride("_method")); 
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.message = req.session.message || null;
  delete req.session.message;
  next();
});

app.get("/", (req, res) => {
  res.render("index");
});
app.get("/signup", (req, res) => {
  res.render("signup");
});
app.get("/login", (req, res) => {
  res.render("login");
});

app.post("/signup", async (req, res) => {
  const { username, password, email, role } = req.body;
  connection.query(
    "SELECT * FROM users WHERE username = ? OR email = ? ",
    [username,email],
    async (err, results) => {
      if (err) {
        console.error(err);
        req.session.message = "An error occurred. Please try again.";
        return res.redirect("/signup");
      }
      if (results.length > 0) {
        req.session.message = "Username or Email already exists.";
        return res.redirect("/signup");
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      connection.query(
        "INSERT INTO users (username, password, email, role) VALUES (?, ?, ?, ?)",
        [username, hashedPassword, email, role],
        (err, result) => {
          if (err) {
            console.error(err);
            req.session.message = "registration failed. Please try again.";
            return res.redirect("/signup");
          }
          req.session.message = "User registered successfully.";
          res.redirect("/login");
        }
      );
    });});

//Login
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  connection.query(
    "SELECT * FROM users WHERE username = ?",
    [username],
    async (err, results) => {
      if (err) {
        console.error(err);
        req.session.message = "An error occurred. Please try again.";
        return res.redirect("/login");
      }
      if (results.length === 0) {
        req.session.message = "User not found.";
        return res.redirect("/login");
      }
      const user = results[0];
      const match = await bcrypt.compare(password, user.password);
      if (!match) {
        req.session.message = "Invalid password.";
        return res.redirect("/login");
      }
      req.session.user = {
        user_id: user.user_id,
        username: user.username,
        role: user.role,
      };
      res.redirect("/");
    }
  );
});
//Logout
app.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error(err);
      return res.status(500).send("Error logging out");
    }
    res.redirect("/");
  });
});

function isAuthenticated(req, res, next) {
  if (req.session.user) {
    return next();
  }
  req.session.message = "You dont have access to this page.";
  res.redirect("/login");
}

function isAdmin(req, res, next) {
  if (req.session.user && req.session.user.role === "admin") {
    return next();
  }
  req.session.message = "You dont have access to this page.";
  res.redirect("/");
}

//rooms
app.get("/reserveroom", isAuthenticated, (req, res)=>{
  connection.query("SELECT * FROM rooms", (err, rooms) => {
    if (err) {
      console.error(err);
      req.session.message = "Failed to load rooms.";
      return res.redirect("/");
    }
  res.render("room_reservation", {rooms});
  });
});

app.post("/reserveroom", isAuthenticated, (req, res) => {
    const {
      reservation_date,
      description,
      room_id,
    } = req.body;
    const query =
      "INSERT INTO reservations (user_id, reservation_date, description, room_id) VALUES (?, ?, ?, ?)";
    connection.query(
      query,
      [req.session.user.user_id, reservation_date, description, room_id],
      (err, result) => {
        if (err) {
          console.error(err);
          req.session.message = "Failed to resrve a room.";
          return res.redirect("/reserveroom");
        }
        req.session.message = "Room reserved successfully.";
        res.redirect("/appointments");
    });
  });
  
//booking appointments
app.get("/book", isAuthenticated, (req, res) => {
  // Fetch doctors and rooms to populate dropdowns
  connection.query("SELECT * FROM doctors", (err, doctors) => {
    if (err) {
      console.error(err);
      req.session.message = "Failed to load doctors.";
      return res.redirect("/book");
    }
      res.render("book", {doctors});
    });
  });

app.post("/book", isAuthenticated, (req, res) => {
  const {
    appointment_date,
    description,
    doctor_id,
  } = req.body;
  const query =
    "INSERT INTO appointments (user_id, appointment_date, description, doctor_id) VALUES (?, ?, ?, ?)";
  connection.query(
    query,
    [req.session.user.user_id, appointment_date, description, doctor_id],
    (err, result) => {
      if (err) {
        console.error(err);
        req.session.message = "Failed to book appointment.";
        return res.redirect("/book");
      }
      req.session.message = "Doctor appointment booked successfully.";
      res.redirect("/appointments");
        });
  });
  
 app.get("/appointments", isAuthenticated, (req, res) => {
    const user_id = req.session.user.user_id;
    connection.query(
      'SELECT a.*, d.name FROM appointments a NATURAL JOIN doctors d WHERE user_id = ? AND status != "cancelled"',
      [user_id],
      (err, appointments) => {
        if (err) {
          console.error(err);
          req.session.message = "Failed to retrieve appointments.";
          return res.redirect("/");
        }
        connection.query(
          'SELECT a.*, r.room_name FROM reservations a NATURAL JOIN rooms r WHERE user_id = ? AND status != "cancelled"',
          [user_id],
          (err, reservations) => {
            if (err) {
              console.error(err);
              req.session.message = "Failed to retrieve reservations.";
              return res.redirect("/");
            }
            res.render("appointments", { appointments, reservations });
          }
        );
      }
    );
});

// Get Manage Doctors Page
app.get("/admin/doctors", isAuthenticated, isAdmin, (req, res) => {
  connection.query("SELECT * FROM doctors", (err, doctors) => {
    if (err) {
      console.error(err);
      req.session.message = "Failed to retrieve doctors.";
      return res.redirect("/admin");
    }
    res.render("admin_manage_doctors", { doctors });
  });
});

app.post("/admin/doctors", isAuthenticated, isAdmin, (req, res) => {
  const { name, specialty, availability_start, availability_end } = req.body;

  const query =
    "INSERT INTO doctors (name, specialty, availability_start, availability_end) VALUES (?, ?, ?, ?)";
  connection.query(
    query,
    [name, specialty, availability_start || null, availability_end || null],
    (err) => {
      if (err) {
        console.error(err);
        req.session.message = "Failed to add doctor.";
        return res.redirect("/admin/doctors");
      }
      req.session.message = "Doctor added successfully.";
      res.redirect("/admin/doctors");
    }
  );
});

app.delete("/admin/doctors/:id", isAuthenticated, isAdmin, (req, res) => {
  const doctor_id = req.params.id;
  connection.query(
    "DELETE FROM doctors WHERE doctor_id = ?",
    [doctor_id],
    (err) => {
      if (err) {
        console.error(err);
        req.session.message = "Failed to delete doctor entry.";
        return res.redirect("/admin/doctors");
      }
      res.send("Doctor deleted successfully.");
      res.redirect("/admin/doctors");
    }
  );
});

//Admin reservations/appointments
app.get("/admin/appointments", isAuthenticated, isAdmin, (req, res) => {
  const appointmentsQuery = `
    SELECT a.*, u.username, d.name AS doctor_name
    FROM appointments a
    JOIN users u ON a.user_id = u.user_id
    LEFT JOIN doctors d ON d.doctor_id = a.doctor_id
    WHERE a.status != "cancelled"
    ORDER BY a.appointment_date DESC
  `;
  connection.query(appointmentsQuery, (err, appointments) => {
    if (err) {
      console.error(err);
      req.session.message = "Failed to retrieve appointments.";
      return res.redirect("/admin_manage_appointments");
    }
    const reservationsQuery = `
      SELECT r.*, u.username, rm.room_name
      FROM reservations r
      JOIN users u ON r.user_id = u.user_id
      LEFT JOIN rooms rm ON r.room_id = rm.room_id
      WHERE r.status != "cancelled"
      ORDER BY r.reservation_date DESC
    `;
    connection.query(reservationsQuery, (err, reservations) => {
      if (err) {
        console.error(err);
        req.session.message = "Failed to retrieve reservations.";
        return res.redirect("/admin_manage_appointments");
      }
      res.render("admin_manage_appointments", { appointments, reservations });
    });
  });
});

app.patch("/reservations/:id", isAuthenticated, (req, res) => {
  const reservationId = req.params.id;
  const userId = req.session.user.user_id;
  connection.query(
    "SELECT * FROM reservations NATURAL JOIN( SELECT room_id, room_name FROM rooms) AS sub1 NATURAL JOIN (SELECT user_id, username FROM users) AS sub2 WHERE reservation_id = ?",
    [reservationId],
    (err, result) => {
      if (err || result.length === 0) {
        console.error(err);
        req.session.message = "Failed to retrieve reservation.";
        return res.redirect("/reservations");
      }
      const reservation = result[0];
      connection.query(
        "INSERT INTO archive (type, original_id, user_name, room_name, date_time, status) VALUES (?, ?, ?, ?, ?, ?)",
        [
          "reservation",
          reservation.reservation_id,
          reservation.username,
          reservation.room_name,
          reservation.reservation_date,
          "cancelled",
        ],
        (err) => {
          if (err) {
            console.error(err);
            req.session.message = "Failed to archive reservation.";
            return res.redirect("/reservations");
          }
          connection.query(
            "UPDATE reservations SET status = 'cancelled' WHERE reservation_id = ?",
            [reservationId]
          );
          req.session.message = "Reservation archived successfully.";
          res.redirect("back");
        }
      );
    }
  );
});

app.patch("/appointments/:id", isAuthenticated, (req, res) => {
  const appointmentId = req.params.id;
  const userId = req.session.user.user_id;
  connection.query(
    "SELECT * FROM appointments NATURAL JOIN( SELECT doctor_id, name AS doctor_name FROM doctors) AS sub1 NATURAL JOIN (SELECT user_id, username FROM users) AS sub2 WHERE appointment_id = ?",
    [appointmentId],
    (err, result) => {
      if (err || result.length === 0) {
        console.error(err);
        req.session.message = "Failed to retrieve appointment.";
        return res.redirect("/appointments");
      }
      const appointment = result[0];
      connection.query(
      "INSERT INTO archive (type, original_id, user_name, doctor_name, date_time, status) VALUES (?, ?, ?, ?, ?, ?)",
        [
          "appointment",
          appointment.appointment_id,
          appointment.username,
          appointment.doctor_name,
          appointment.appointment_date,
          "cancelled",
        ],
        (err) => {
          if (err) {
            console.error(err);
            req.session.message = "Failed to archive appointment.";
            return res.redirect("/appointments");
          }
          connection.query(
            "UPDATE appointments SET status = 'cancelled' WHERE appointment_id = ?",
            [appointmentId]
          );
          req.session.message = "Appointment archived successfully.";
          res.redirect("back");
        }
      );
    }
  );
});

app.patch("/admin/reservations/:id/accepted", isAuthenticated, isAdmin, (req, res) => {
  const reservation_id = req.params.id;
  connection.query(
    "UPDATE reservations SET status = 'accepted' WHERE reservation_id = ?",
    [reservation_id],
    (err) => {
      if (err) {
        console.error(err);
        req.session.message = "Failed to update reservation status.";
        return res.redirect("/");
      }
      req.session.message = `Reservation accepted successfully.`;
      res.redirect("back");
    }
  );
});

app.patch("/admin/appointments/:id/accepted", isAuthenticated, isAdmin, (req, res) => {
  const reservation_id = req.params.id;
  connection.query(
    "UPDATE appointments SET status = 'accepted' WHERE appointment_id = ?",
    [reservation_id],
    (err) => {
      if (err) {
        console.error(err);
        req.session.message = "Failed to update reservation status.";
        return res.redirect("/");
      }
      req.session.message = `Appointment accepted successfully.`;
      res.redirect("back");
    }
  );
});

app.get("/admin/archive", isAuthenticated, isAdmin, (req, res) => {
  const appointmentsQuery = "SELECT a.*, d.name, u.username FROM appointments a NATURAL JOIN users u NATURAL JOIN doctors d WHERE status = 'cancelled'";
  const reservationsQuery = "SELECT a.*, r.room_name, u.username FROM reservations a NATURAL JOIN users u NATURAL JOIN rooms r WHERE status = 'cancelled'";
  connection.query(appointmentsQuery, (err, appointments) => {
    if (err) {
      console.error(err);
      req.session.message = "Failed to retrieve archived appointments.";
      return res.redirect("/admin");
    }
    connection.query(reservationsQuery, (err, reservations) => {
      if (err) {
        console.error(err);
        req.session.message = "Failed to retrieve archived reservations.";
        return res.redirect("/admin");
      }
      res.render("admin_archive", { appointments, reservations });
    });
  });
});

app.get("/admin/users", isAuthenticated, isAdmin, (req, res) => {
  connection.query("SELECT * FROM users", (err, users) => {
    if (err) {
      console.error(err);
      req.session.message = "Failed to retrieve users.";
      return res.redirect("/admin");
    }
    res.render("admin_manage_users", { users });
  });
});

// Admin Rooms
app.get("/admin/rooms", isAuthenticated, isAdmin, (req, res) => {
  const roomsQuery = "SELECT * FROM rooms";
  connection.query(roomsQuery, (err, rooms) => {
    if (err) {
      console.error(err);
      req.session.message = "Failed to retrieve rooms.";
      return res.redirect("/admin");
    }
    res.render("admin_manage_rooms", {rooms});
  });
});

app.post("/admin/rooms", isAuthenticated, isAdmin, (req, res) => {
  const {
    room_name,
    room_capacity,
    availability_start,
    availability_end,
  } = req.body;
  const query =
    "INSERT INTO rooms (room_name, room_capacity, availability_start, availability_end) VALUES (?, ?, ?, ?)";
  connection.query(
    query,
    [
      room_name,
      room_capacity,
      availability_start || null,
      availability_end || null,
    ],
    (err) => {
      if (err) {
        console.error(err);
        req.session.message = "Failed to add room.";
        return res.redirect("/admin/rooms");
      }
      req.session.message = "Room added successfully.";
      res.redirect("/admin/rooms");
    }
  );
});

app.delete("/admin/rooms/:id", isAuthenticated, isAdmin, (req, res) => {
  const room_id = req.params.id;

  connection.query("DELETE FROM rooms WHERE room_id = ?", [room_id], (err) => {
    if (err) {
      console.error(err);
      req.session.message = "Failed to delete room.";
      return res.redirect("/admin/rooms");
    }
    req.session.message = "Room deleted successfully.";
    res.redirect("/admin/rooms");
  });
});

// articles
app.get("/admin/articles", isAuthenticated, isAdmin, (req, res) => {
  const query = "SELECT articles.title, images, description, link, views FROM articles LEFT OUTER JOIN (SELECT COUNT(DISTINCT user_id) AS views, title FROM user_articles GROUP BY title) AS sub ON articles.title = sub.title ORDER BY views DESC";
  connection.query(query, (err, articles) => {
    if (err) {
      console.error(err);
      req.session.message = "Failed to retrieve articles.";
      return res.redirect("/admin");
    }
    res.render("admin_manage_articles", {articles});
  });
});

app.post("/admin/articles", isAuthenticated, isAdmin, upload.single("images"),
  (req, res) => {
    const { title, description, link } = req.body;
    let images = null;
    if (req.file) {
      images = req.file.buffer;
    }
    const query ="INSERT INTO articles (title, images, description, link) VALUES (?, ?, ?, ?)";
    connection.query(query, [title, images, description, link], (err) => {
      if (err) {
        console.error(err);
        req.session.message = "Failed to add article.";
        return res.redirect("/admin/articles");
      }
      req.session.message = "Article added successfully.";
      res.redirect("/admin/articles");
    });
  }
);

app.delete("/admin/articles/:id", isAuthenticated, isAdmin, (req, res) => {
  const title = req.params.id;
  connection.query(
    "DELETE FROM articles WHERE title = ?",
    [title],
    (err) => {
      if (err) {
        console.error(err);
        req.session.message = "Failed to delete article.";
        return res.redirect("/admin/articles");
      }
      req.session.message = "Article deleted successfully.";
      res.redirect("/admin/articles");
    }
  );
});

// community 
app.get("/admin/community", isAuthenticated, isAdmin, (req, res) => {
  const query = "SELECT * FROM community ORDER BY community_name DESC";
  connection.query(query, (err, communities) => {
    if (err) {
      console.error(err);
      req.session.message = "Failed to retrieve community entries.";
      return res.redirect("/admin");
    }
    res.render("admin_manage_community", {communities});
  });
});

app.post("/admin/community", isAuthenticated, isAdmin, upload.single("images"), (req, res) => {
    const { community_name, description, link } = req.body;
    let images = null;
    if (req.file) {
      images = req.file.buffer; 
    }
    const query = "INSERT INTO community (community_name, images, description, link) VALUES (?, ?, ?, ?)";
    connection.query(
      query,
      [community_name, images, description, link],
      (err) => {
        if (err) {
          console.error(err);
          req.session.message = "Failed to add community entry.";
          return res.redirect("/admin/community");
        }
        req.session.message = "Community entry added successfully.";
        res.redirect("/admin/community");
      }
    );
  }
);

app.delete("/admin/community/:id", isAuthenticated, isAdmin, (req, res) => {
  const community_name = req.params.id;
  connection.query(
    "DELETE FROM community WHERE community_name = ?",
    [community_name],
    (err) => {
      if (err) {
        console.error(err);
        req.session.message = "Failed to delete community entry.";
        return res.redirect("/admin/community");
      }
      req.session.message = "Community entry deleted successfully.";
      res.redirect("/admin/community");
    }
  );
});

app.get("/doctors", isAuthenticated, (req, res) => {
  const query = "SELECT * FROM doctors";
  connection.query(query, (err, doctors) => {
    if (err) {
      console.error(err);
      req.session.message = "Failed to retrieve doctors.";
      return res.redirect("/");
    }
    res.render("doctors", { doctors });
  });
});

// user sees available rooms
app.get("/rooms", isAuthenticated, (req, res) => {
  const query = "SELECT * FROM rooms";
  connection.query(query, (err, rooms) => {
    if (err) {
      console.error(err);
      req.session.message = "Failed to retrieve rooms.";
      return res.redirect("/");
    }
    res.render("rooms", { rooms });
  });
});

app.post("/blog/:title", isAuthenticated, (req, res) => {
  connection.query("INSERT INTO user_articles (title, user_id) VALUES(?,?)",
    [ req.params.title, req.session.user.user_id],
    (err) => {
      if (err) { 
      console.error(err);
      req.session.message = "Failed to record your action.";
      return res.redirect("/");
      }
      res.status(204).end();
    })
})

app.get("/blog", isAuthenticated, (req, res) => {
  const query = "SELECT articles.title, images, description, link, views FROM articles LEFT OUTER JOIN (SELECT COUNT(DISTINCT user_id) AS views, title FROM user_articles GROUP BY title) AS sub ON articles.title = sub.title ORDER BY views DESC";
  connection.query(query, (err, articles) => {
    if (err) {
      console.error(err);
      req.session.message = "Failed to retrieve blog articles.";
      return res.redirect("/");
    }
    res.render("blog", {articles});
  });
});

app.get("/community", isAuthenticated, (req, res) => {
  const user_id = req.session.user.user_id
  const query = "SELECT c.* FROM community c LEFT JOIN user_community uc ON c.community_name = uc.community_name AND uc.user_id = ? WHERE uc.community_name IS NULL ORDER BY c.community_name DESC;";
  connection.query(query, [user_id], (err, communities) => {
    if (err) {
      console.error(err);
      req.session.message = "Failed to retrieve community entries.";
      return res.redirect("/");
    }
    connection.query("SELECT * FROM community NATURAL JOIN (SELECT community_name, date_joined FROM user_community where user_id=?) AS sub ORDER BY date_joined", [user_id], (err, mycommunities)=> {
      if(err){
        if (err) {
          console.error(err);
          req.session.message = "Failed to retrieve your communities.";
          return res.redirect("/");
        }
      }
      res.render("community", { communities, mycommunities});
    })
  });
});

app.post("/community/:community_name", isAuthenticated, (req, res) => {
  connection.query("INSERT INTO user_community (user_id, community_name, date_joined) VALUES(?,?,CURDATE()) ",
  [req.session.user.user_id, req.params.community_name],
  (err) => {
      if(err){
        if (err) {
          console.error(err);
          req.session.message = "Failed to join community entries.";
          return res.redirect("/community");
        }
      }
    req.session.message = `you just joined the community successfully`;
    res.redirect("/community");
  })
});

app.delete("/community/:community_name", isAuthenticated, (req, res)=>{
  connection.query("DELETE FROM user_community WHERE user_id = ? AND community_name = ?", 
    [req.session.user.user_id, req.params.community_name], (err) =>{
      if(err){
        console.error(err);
        req.session.message = "Failed to leave community.";
        return res.redirect("/community");
      }
      req.session.message = "you left the community";
      res.redirect("/community");
    }
  )
});

app.listen(PORT, () => {
  console.log(`http://localhost:${PORT}`);
});
