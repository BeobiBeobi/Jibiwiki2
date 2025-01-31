const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const path = require("path");
const cors = require("cors");
const fs = require("fs");
const mongoose = require('mongoose');
const Post = require('./models/Post');  // 이 줄 추가
const User = require('./models/User');

const EXP_VALUES = {
    POST_CREATED: 10,         // 게시물 작성
    POST_DELETED: -10,        // 게시물 삭제
    LIKE_RECEIVED: 5,         // 좋아요 받음
    LIKE_REMOVED: -5,         // 좋아요 취소됨
    LIKE_GIVEN: 2,            // 좋아요 누름
    LIKE_WITHDRAWN: -2,       // 좋아요 취소함
    EXPLANATION_ADDED: 5,     // 해명 작성
    EXPLANATION_DELETED: -5   // 해명 삭제
};

app.use(bodyParser.json()); // for parsing application/json


mongoose.connect('mongodb+srv://admin:sh22767636@cluster0.wxftu.mongodb.net/')
  .then(() => console.log('MongoDB 연결 성공'))
  .catch(err => console.error('MongoDB 연결 실패:', err));


const usersFile = path.join(__dirname, "users.json"); // 사용자 데이터를 저장할 파일
const postsFile = path.join(__dirname, "posts.json"); // 사용자 데이터를 저장할 파일
let users = [];

if (fs.existsSync(usersFile)) {
  users = JSON.parse(fs.readFileSync(usersFile, "utf-8"));
}

// CORS 설정
app.use(cors());

// 게시물 데이터를 저장할 배열
let posts = [];

// POST 데이터를 처리하기 위한 설정
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 정적 파일 제공
app.use(express.static(path.join(__dirname, "public")));

// 서버 실행


// 기본 페이지
app.get("/", function (req, res) {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// "게시물 읽기" 페이지
app.get("/read", function (req, res) {
  res.send("게시물을 읽는 페이지 입니다.");
});

// 특정 작성자용 페이지
app.get("/write/:name", (req, res) => {
  const { name } = req.params;
  const allowedNames = ["Jibi", "Jini", "Seobin", "Beobi", "Ddonggae", "Namgyu", "Seoyeon", "Yumin"];
  
  if (allowedNames.includes(name)) {
    res.sendFile(path.join(__dirname, "public", `write${name}.html`));
  } else {
    res.status(404).send("작성자를 찾을 수 없습니다.");
  }
});

// 경험치 업데이트 라우트
app.post("/user/:username/exp", async (req, res) => {
  try {
      const { username } = req.params;
      const { expAmount } = req.body;

      let user = await User.findOne({ username });
      if (!user) {
          user = new User({ username });
      }

      // 이전 레벨과 경험치 저장
      const oldLevel = user.level;
      const oldExp = user.exp;

      // 경험치 업데이트
      user.exp = Math.max(0, user.exp + expAmount);
      
      // 레벨 업데이트
      const prevLevel = user.level;
      user.updateLevel();
      const newLevel = user.level;

      await user.save();

      // 레벨업 여부 확인
      const leveledUp = prevLevel !== newLevel;

      // 클라이언트에 결과 전송
      res.json({
          success: true,
          leveledUp: leveledUp,
          oldLevel: prevLevel,
          newLevel: newLevel,
          oldExp: oldExp,
          newExp: user.exp
      });

  } catch (error) {
      console.error('경험치 업데이트 오류:', error);
      res.status(500).json({ error: "경험치 업데이트 중 오류가 발생했습니다." });
  }
});

app.delete("/post/:id", async (req, res) => {
  try {
      const { id } = req.params;
      const { username } = req.body;

      const post = await Post.findById(id);
      if (!post) {
          return res.status(404).json({ error: "게시물을 찾을 수 없습니다." });
      }

      // 삭제 권한 확인
      if (post.username !== username && username !== 'master@0422') {
          return res.status(403).json({ error: "삭제 권한이 없습니다." });
      }

      // 게시물 작성자의 경험치 차감
      await updateUserExp(post.username, EXP_VALUES.POST_DELETED);

      // 좋아요 관련 경험치 차감
      if (post.likes && post.likes.users.length > 0) {
          // 게시물 작성자의 받은 좋아요 경험치 차감
          const totalLikesExp = post.likes.users.length * EXP_VALUES.LIKE_REMOVED;
          await updateUserExp(post.username, totalLikesExp);

          // 좋아요를 누른 사용자들의 경험치 차감
          for (const like of post.likes.users) {
              await updateUserExp(like.username, EXP_VALUES.LIKE_WITHDRAWN);
          }
      }

      // 게시물 삭제
      await Post.findByIdAndDelete(id);
      res.json({ message: "게시물이 삭제되었습니다." });

  } catch (error) {
      console.error('게시물 삭제 오류:', error);
      res.status(500).json({ error: "게시물 삭제 중 오류가 발생했습니다." });
  }
});

app.post("/post/:id/explain", async (req, res) => {
  try {
      const { id } = req.params;
      const { content, username } = req.body;

      // 입력값 검증
      if (!content || !username) {
          return res.status(400).json({ error: "필수 입력값이 누락되었습니다." });
      }

      const post = await Post.findById(id);
      if (!post) {
          return res.status(404).json({ error: "게시물을 찾을 수 없습니다." });
      }

      // 해명 권한 확인
      const hasPermission = (
        (post.category === '버비' && username === '버비(조XX)') ||
        (post.category === '지비' && username === '지비(박XX)') ||
        (post.category === '지니' && username === '지니(김XX)') ||
        (post.category === '서빈' && username === '서빈(김XX)') ||
        (post.category === '서연' && username === '서연(남XX)') ||
        (post.category === '유만' && username === '유만(이XX)') ||
        (post.category === '남규' && username === '남규(김XX)') ||
        (post.category === '똥개' && username === '똥개(서XX)') ||
          
          
        username === 'master@0422'
      );

      if (!hasPermission) {
          return res.status(403).json({ error: "해명을 작성할 권한이 없습니다." });
      }

      // 이미 해명이 있는 경우
      if (post.explanation && post.explanation.content) {
          return res.status(400).json({ error: "이미 해명이 존재합니다." });
      }

      // 해명 추가
      post.explanation = {
          content: content,
          timestamp: new Date()
      };

      await post.save();

      await updateUserExp(username, EXP_VALUES.EXPLANATION_ADDED);


      return res.json({
          message: "해명이 추가되었습니다.",
          post: post
      });

  } catch (error) {
      console.error('해명 추가 오류:', error);
      return res.status(500).json({ error: "해명 추가 중 오류가 발생했습니다." });
  }
});

app.delete("/post/:id/explain", async (req, res) => {
  try {
      const { id } = req.params;
      const { username } = req.body;

      // 입력값 검증
      if (!username) {
          return res.status(400).json({ error: "사용자 정보가 필요합니다." });
      }

      const post = await Post.findById(id);
      if (!post) {
          return res.status(404).json({ error: "게시물을 찾을 수 없습니다." });
      }

      // 해명 삭제 권한 확인
      const hasPermission = (
          (post.category === '버비' && username === '버비(조XX)') ||
          (post.category === '지비' && username === '지비(박XX)') ||
          (post.category === '지니' && username === '지니(김XX)') ||
          (post.category === '서빈' && username === '서빈(김XX)') ||
          (post.category === '서연' && username === '서연(남XX)') ||
          (post.category === '유만' && username === '유만(이XX)') ||
          (post.category === '남규' && username === '남규(김XX)') ||
          (post.category === '똥개' && username === '똥개(서XX)') ||
          
          
          username === 'master@0422'
      );

      if (!hasPermission) {
          return res.status(403).json({ error: "해명을 삭제할 권한이 없습니다." });
      }

      // 해명이 없는 경우
      if (!post.explanation) {
          return res.status(400).json({ error: "삭제할 해명이 없습니다." });
      }

      // 해명 삭제
      post.explanation = undefined;
      await post.save();

      await updateUserExp(username, EXP_VALUES.EXPLANATION_DELETED);

      return res.json({
          message: "해명이 삭제되었습니다.",
          post: post
      });

  } catch (error) {
      console.error('해명 삭제 오류:', error);
      return res.status(500).json({ error: "해명 삭제 중 오류가 발생했습니다." });
  }
});

app.get("/warning", function (req, res) {
  res.sendFile(path.join(__dirname, "public", "warning.html"));
});


// 게시물 작성 (POST 요청)
app.post("/post", async (req, res) => {
  try {
    const { title, description, username, category } = req.body;
    
    const post = new Post({
      title,
      description,
      username,
      category
    });

    await post.save();

    await updateUserExp(username, EXP_VALUES.POST_CREATED);


    res.status(201).json({ message: "게시물이 성공적으로 작성되었습니다." });
  } catch (error) {
    console.error('게시물 작성 오류:', error);
    res.status(500).json({ error: "게시물 작성 중 오류가 발생했습니다." });
  }
});

app.get("/posts", async (req, res) => {
  try {
      const posts = await Post.find()
          .sort({ 'likes.count': -1, timestamp: -1 }); // 좋아요 순으로 정렬
      res.json(posts);
  } catch (error) {
      res.status(500).json({ error: "게시물 조회 중 오류가 발생했습니다." });
  }
});

// Write 페이지
app.get("/write", function (req, res) {
  res.sendFile(path.join(__dirname, "public", "write.html"));
});



app.post("/post/:id/like", async (req, res) => {
  try {
      const { id } = req.params;
      const { username } = req.body;
      
      const post = await Post.findById(id);
      if (!post) {
          return res.status(404).json({ error: "게시물을 찾을 수 없습니다." });
      }

      const userLikeIndex = post.likes.users.findIndex(like => like.username === username);
      
      if (userLikeIndex === -1) {
          // 좋아요 추가
          post.likes.users.push({ username, likedAt: new Date() });
          post.likes.count += 1;

          // 좋아요 준 사용자에게 경험치 추가
          await updateUserExp(username, EXP_VALUES.LIKE_GIVEN);
          
          // 좋아요 받은 사용자에게 경험치 추가
          await updateUserExp(post.username, EXP_VALUES.LIKE_RECEIVED);
      } else {
          // 좋아요 제거
          post.likes.users.splice(userLikeIndex, 1);
          post.likes.count -= 1;

          // 좋아요 취소한 사용자의 경험치 차감
          await updateUserExp(username, EXP_VALUES.LIKE_WITHDRAWN);
          
          // 좋아요 취소된 게시물 작성자의 경험치 차감
          await updateUserExp(post.username, EXP_VALUES.LIKE_REMOVED);
      }

      await post.save();
      res.json({ likes: post.likes.count, hasLiked: userLikeIndex === -1 });
  } catch (error) {
      console.error('좋아요 처리 오류:', error);
      res.status(500).json({ error: "좋아요 처리 중 오류가 발생했습니다." });
  }
});

async function updateUserExp(username, expAmount) {
  try {
      let user = await User.findOne({ username });
      
      if (!user) {
          user = new User({ username });
      }

      const oldLevel = user.level; // 이전 레벨 저장
      
      // 경험치 업데이트 (최소값 0으로 제한)
      user.exp = Math.max(0, user.exp + expAmount);
      
      // 레벨 업데이트
      user.updateLevel();
      
      await user.save();

      // 레벨업 여부 확인
      const leveledUp = oldLevel !== user.level;
      
      return {
          user,
          leveledUp,
          oldLevel,
          newLevel: user.level
      };
  } catch (error) {
      console.error('경험치 업데이트 오류:', error);
      throw error;
  }
}



// 사용자 정보 조회 라우트 수정
app.get("/user/:username", async (req, res) => {
  try {
      const { username } = req.params;
      
      // 사용자 찾기, 없으면 새로 생성
      let user = await User.findOne({ username });
      
      if (!user) {
          // 새 사용자 생성
          user = new User({
              username: username,
              exp: 0,
              level: '잣밥',
              stats: {
                  postsCreated: 0,
                  likesReceived: 0,
                  likesGiven: 0
              }
          });
          await user.save();
      }

      res.json({
          username: user.username,
          level: user.level,
          exp: user.exp,
          stats: user.stats
      });
  } catch (error) {
      console.error('사용자 정보 조회 오류:', error);
      res.status(500).json({ error: "사용자 정보 조회 중 오류가 발생했습니다." });
  }
});

async function initializeExistingUsers() {
  try {
      // 모든 게시물에서 고유한 사용자명 추출
      const posts = await Post.find({});
      const uniqueUsernames = [...new Set(posts.map(post => post.username))];

      // 각 사용자에 대해 정보 생성 (없는 경우에만)
      for (const username of uniqueUsernames) {
          const existingUser = await User.findOne({ username });
          if (!existingUser) {
              const newUser = new User({
                  username: username,
                  exp: 0,
                  level: '잣밥',
                  stats: {
                      postsCreated: 0,
                      likesReceived: 0,
                      likesGiven: 0
                  }
              });
              await newUser.save();
              console.log(`Created user data for: ${username}`);
          }
      }
      console.log('User initialization completed');
  } catch (error) {
      console.error('User initialization error:', error);
  }
}

// 서버 시작 시 기존 사용자 초기화 실행
initializeExistingUsers();

const PORT = process.env.PORT || 1313;
app.listen(PORT, () => {
  console.log(`서버가 실행 중입니다: http://localhost:${PORT}`);
});
