const searchForm = document.querySelector("#searchForm");
const searchInput = document.querySelector("#searchInput");
const statusMessage = document.querySelector("#statusMessage");
const purchaseMessage = document.querySelector("#purchaseMessage");
const bookList = document.querySelector("#bookList");
const signUpForm = document.querySelector("#signUpForm");
const signInForm = document.querySelector("#signInForm");
const signOutButton = document.querySelector("#signOutButton");
const authMessage = document.querySelector("#authMessage");
const loggedOutArea = document.querySelector("#loggedOutArea");
const loggedInArea = document.querySelector("#loggedInArea");
const userEmail = document.querySelector("#userEmail");
const ordersSection = document.querySelector("#ordersSection");
const ordersMessage = document.querySelector("#ordersMessage");
const ordersList = document.querySelector("#ordersList");

let currentSession = null;
let orderRequestVersion = 0;

function setStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.classList.toggle("error", isError);
}

function setAuthMessage(message, isError = false) {
  authMessage.textContent = message;
  authMessage.classList.toggle("error", isError);
}

function setPurchaseMessage(message, isError = false) {
  purchaseMessage.textContent = message;
  purchaseMessage.classList.toggle("error", isError);
}

function setOrdersMessage(message, isError = false) {
  ordersMessage.textContent = message;
  ordersMessage.classList.toggle("error", isError);
}

function setAuthButtonsDisabled(isDisabled) {
  document.querySelectorAll(".auth-section button").forEach((button) => {
    button.disabled = isDisabled;
  });
}

function renderAuthState(session) {
  // 이메일과 access token이 모두 있는 실제 Supabase 세션만 로그인으로 표시합니다.
  const email = session?.user?.email;
  const hasAccessToken = typeof session?.access_token === "string" && session.access_token.length > 0;
  const isLoggedIn = hasAccessToken && typeof email === "string" && email.length > 0;
  const previousUserId = currentSession?.user?.id;
  const nextUserId = isLoggedIn ? session.user.id : null;

  currentSession = isLoggedIn ? session : null;
  loggedOutArea.hidden = isLoggedIn;
  loggedInArea.hidden = !isLoggedIn;
  userEmail.textContent = isLoggedIn ? email : "";
  ordersSection.hidden = !isLoggedIn;
  setAuthMessage(isLoggedIn ? "" : "로그인하지 않았습니다.");

  if (!isLoggedIn || (previousUserId && previousUserId !== nextUserId)) {
    // 로그아웃 또는 회원 전환 뒤에는 이전 회원의 주문을 즉시 지웁니다.
    orderRequestVersion += 1;
    ordersList.replaceChildren();
    setOrdersMessage("");
  }
}

function formatPrice(price) {
  return `${new Intl.NumberFormat("ko-KR").format(price)}원`;
}

function formatOrderDate(createdAt) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(createdAt));
}

function showOrders(orders) {
  ordersList.replaceChildren();

  orders.forEach((order) => {
    const item = document.createElement("article");
    const title = document.createElement("h3");
    const quantity = document.createElement("p");
    const amount = document.createElement("p");
    const date = document.createElement("p");

    item.className = "order-item";
    amount.className = "order-amount";
    date.className = "order-date";

    title.textContent = order.book_title;
    quantity.textContent = `수량: ${order.quantity}권`;
    amount.textContent = `결제 금액: ${formatPrice(order.unit_price * order.quantity)}`;
    date.textContent = `주문 시각: ${formatOrderDate(order.created_at)}`;

    item.append(title, quantity, amount, date);
    ordersList.append(item);
  });
}

async function loadOrders(userId) {
  const requestVersion = ++orderRequestVersion;
  ordersList.replaceChildren();
  setOrdersMessage("주문 내역을 불러오는 중입니다.");

  let orders;
  let error;

  try {
    ({ data: orders, error } = await sb
      .from("orders")
      .select("book_title, quantity, unit_price, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }));
  } catch (requestError) {
    if (requestVersion === orderRequestVersion && currentSession?.user?.id === userId) {
      console.error(requestError);
      setOrdersMessage("주문 내역 요청을 처리하지 못했습니다.", true);
    }
    return;
  }

  // 로그아웃 또는 회원 전환 뒤에 도착한 이전 요청의 응답은 화면에 표시하지 않습니다.
  if (requestVersion !== orderRequestVersion || currentSession?.user?.id !== userId) {
    return;
  }

  if (error) {
    console.error(error);
    setOrdersMessage("주문 내역을 불러오지 못했습니다.", true);
    return;
  }

  if (!orders || orders.length === 0) {
    setOrdersMessage("주문 내역이 없습니다.");
    return;
  }

  showOrders(orders);
  setOrdersMessage(`주문 ${orders.length}건을 불러왔습니다.`);
}

async function purchaseBook(book, quantity, purchaseButton) {
  const sessionAtStart = currentSession;

  if (!sessionAtStart) {
    setPurchaseMessage("로그인 후 구매할 수 있습니다.", true);
    return;
  }

  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
    setPurchaseMessage("수량은 1부터 10 사이의 정수로 입력해 주세요.", true);
    return;
  }

  const expectedAmount = book.price * quantity;
  const isConfirmed = window.confirm(
    `${book.title}\n수량: ${quantity}권\n예상 금액: ${formatPrice(expectedAmount)}\n\n구매하시겠습니까?`
  );

  if (!isConfirmed) {
    return;
  }

  purchaseButton.disabled = true;
  setPurchaseMessage("모의 구매를 처리하는 중입니다.");

  let error;

  try {
    ({ error } = await sb.rpc("purchase_book", {
      p_book_id: book.id,
      p_quantity: quantity,
    }));
  } catch (requestError) {
    console.error(requestError);
    purchaseButton.disabled = false;
    setPurchaseMessage("구매 요청을 처리하지 못했습니다. 네트워크 연결을 확인해 주세요.", true);
    return;
  }

  purchaseButton.disabled = false;

  if (error) {
    console.error(error);
    setPurchaseMessage(`모의 구매에 실패했습니다: ${error.message}`, true);
    return;
  }

  // 구매 중 로그아웃하거나 다른 회원으로 바뀐 경우, 이전 회원의 결과를 새 화면에 표시하지 않습니다.
  if (currentSession?.user?.id !== sessionAtStart.user.id) {
    return;
  }

  setPurchaseMessage("모의 구매가 완료되었습니다.");
  loadOrders(sessionAtStart.user.id);
}

function showBooks(books) {
  bookList.replaceChildren();

  books.forEach((book) => {
    const card = document.createElement("article");
    const title = document.createElement("h2");
    const author = document.createElement("p");
    const price = document.createElement("p");
    const purchaseControls = document.createElement("div");
    const quantityLabel = document.createElement("label");
    const quantityInput = document.createElement("input");
    const purchaseButton = document.createElement("button");

    card.className = "book-card";
    author.className = "author";
    price.className = "price";
    purchaseControls.className = "purchase-controls";
    quantityInput.id = `quantity-${book.id}`;
    quantityInput.type = "number";
    quantityInput.min = "1";
    quantityInput.max = "10";
    quantityInput.step = "1";
    quantityInput.value = "1";
    quantityInput.inputMode = "numeric";
    quantityLabel.htmlFor = quantityInput.id;
    quantityLabel.textContent = "수량 (1~10)";
    purchaseButton.type = "button";
    purchaseButton.textContent = "구매";

    // DB에서 받은 문자열은 HTML로 해석하지 않고 텍스트로 표시합니다.
    title.textContent = book.title;
    author.textContent = `저자: ${book.author}`;
    price.textContent = formatPrice(book.price);

    purchaseButton.addEventListener("click", () => {
      purchaseBook(book, Number(quantityInput.value), purchaseButton);
    });

    purchaseControls.append(quantityLabel, quantityInput, purchaseButton);
    card.append(title, author, price, purchaseControls);
    bookList.append(card);
  });
}

async function loadBooks() {
  const keyword = searchInput.value.trim();
  setStatus("도서 목록을 불러오는 중입니다.");
  bookList.replaceChildren();

  let query = sb
    .from("books")
    .select("id, title, author, price")
    .order("id", { ascending: true });

  // 검색어가 있을 때만 제목에 검색어가 포함된 도서를 찾습니다.
  if (keyword) {
    query = query.like("title", `%${keyword}%`);
  }

  const { data: books, error } = await query;

  if (error) {
    console.error(error);
    setStatus("도서 목록을 불러오지 못했습니다. 설정값과 Supabase 정책을 확인해 주세요.", true);
    return;
  }

  if (!books || books.length === 0) {
    setStatus("검색 결과가 없습니다.");
    return;
  }

  showBooks(books);
  setStatus(`도서 ${books.length}권을 찾았습니다.`);
}

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  loadBooks();
});

signUpForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = signUpForm.elements.email.value.trim();
  const password = signUpForm.elements.password.value;

  setAuthButtonsDisabled(true);
  setAuthMessage("회원가입을 처리하는 중입니다.");

  const { data, error } = await sb.auth.signUp({ email, password });

  setAuthButtonsDisabled(false);

  if (error) {
    console.error(error);
    setAuthMessage(`회원가입에 실패했습니다: ${error.message}`, true);
    return;
  }

  signUpForm.reset();

  if (!data.session) {
    setAuthMessage("가입 요청이 완료되었습니다. 이메일 확인 후 로그인해 주세요.");
    return;
  }

  renderAuthState(data.session);
  loadOrders(data.session.user.id);
});

signInForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = signInForm.elements.email.value.trim();
  const password = signInForm.elements.password.value;

  setAuthButtonsDisabled(true);
  setAuthMessage("로그인하는 중입니다.");

  const { data, error } = await sb.auth.signInWithPassword({ email, password });

  setAuthButtonsDisabled(false);

  if (error) {
    console.error(error);
    setAuthMessage(`로그인에 실패했습니다: ${error.message}`, true);
    return;
  }

  signInForm.reset();
  renderAuthState(data.session);
  loadOrders(data.session.user.id);
});

signOutButton.addEventListener("click", async () => {
  setAuthButtonsDisabled(true);
  setAuthMessage("로그아웃하는 중입니다.");

  let error;

  try {
    ({ error } = await sb.auth.signOut());
  } catch (requestError) {
    console.error(requestError);
    setAuthButtonsDisabled(false);
    setAuthMessage("로그아웃 요청을 처리하지 못했습니다. 네트워크 연결을 확인해 주세요.", true);
    return;
  }

  setAuthButtonsDisabled(false);

  if (error) {
    console.error(error);
    setAuthMessage(`로그아웃에 실패했습니다: ${error.message}`, true);
    return;
  }

  // 상태 변경 알림이 늦게 와도 성공 직후 화면은 비로그인 상태로 전환합니다.
  renderAuthState(null);
});

async function restoreSession() {
  const { data, error } = await sb.auth.getSession();

  if (error) {
    console.error(error);
    setAuthMessage("로그인 상태를 확인하지 못했습니다.", true);
    return;
  }

  renderAuthState(data.session);

  if (currentSession) {
    loadOrders(currentSession.user.id);
  }
}

// 인증 상태가 바뀔 때 화면만 짧게 갱신합니다. 여기서 비동기 작업을 기다리지 않습니다.
sb.auth.onAuthStateChange((_event, session) => {
  renderAuthState(session);
});

restoreSession();
loadBooks();
